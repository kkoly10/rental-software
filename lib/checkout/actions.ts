"use server";

import { headers } from "next/headers";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { checkoutOrderSchema } from "@/lib/validation/checkout";
import { createOrderNumber } from "@/lib/orders/order-number";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { resolveServiceAreaForAddress } from "@/lib/service-areas/lookup";
import { checkProductAvailability } from "@/lib/availability/check";
import { reserveProductAvailabilityBlock } from "@/lib/availability/blocks";
import { logAppError, logAppEvent } from "@/lib/observability/server";
import { hasStripeEnv, getStripe } from "@/lib/stripe/config";
import { getBookingPolicies } from "@/lib/data/booking-policies";
import { computeOrderTax } from "@/lib/checkout/tax";
import { calculatePrice } from "@/lib/pricing/engine";
import type { PricingRule } from "@/lib/pricing/types";

export type CheckoutFieldErrors = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  eventDate?: string;
};

export type CheckoutActionState = {
  ok: boolean;
  message: string;
  orderNumber?: string;
  fieldErrors?: CheckoutFieldErrors;
  stripeUrl?: string;
  /**
   * What the customer just submitted, echoed back so the form can
   * re-mount with their inputs intact when the action returns an
   * error. Without this, useActionState re-renders the form with
   * empty defaults and the customer has to retype every field
   * (first name, last name, phone, email, address, city, state) just
   * because their ZIP was out of coverage or terms weren't checked.
   * Conversion-killer at scale. Populated on every error return; on
   * success the form unmounts so we leave it undefined.
   */
  submittedValues?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    eventDate?: string;
    startTime?: string;
    endTime?: string;
    rentalEndDate?: string;
  };
  // Order summary fields — populated on success so the form can show a review screen
  summary?: {
    productName: string;
    /**
     * Phase 3b — multi-item carts list every rental line here so the
     * review screen / confirmation can show all N products instead of a
     * single `productName`. Only `line_type='rental'` parents are listed
     * (add-on / waiver children are folded into their parent's price).
     * Undefined for the single-item path, which keeps using `productName`.
     */
    items?: { name: string; quantity: number; lineTotal: string }[];
    eventDate: string;
    address: string;
    subtotal: string;
    deliveryFee: string;
    /** Sales/rental tax line — present only when the operator's
     *  tax_rules matched the delivery jurisdiction and produced a
     *  non-zero amount. Undefined for pickup orders or unmatched
     *  jurisdictions. */
    tax?: string;
    /** Operator-facing label from the matched tax_rule. Shown next
     *  to the tax amount on the review screen. */
    taxLabel?: string;
    total: string;
    depositDue: string;
    balanceDue: string;
    // Sprint 6.0 — surfaced on the review screen as its own line item
    // so the customer sees "(+$50 Wet upcharge)" explicitly instead
    // of having to reconcile the subtotal in their head against the
    // dry price they saw on the storefront. Only set when the wet
    // upcharge applies; undefined for dry rentals, single-mode
    // products, or wet rentals where the operator left the upcharge
    // blank.
    wetUpcharge?: string;
    // Populated when the deposit minimum exceeded the order total and
    // the system clamped the deposit down to the total. Surfaced on the
    // review screen so a customer paying $50 on a $100-minimum config
    // sees why, instead of the deposit silently shrinking.
    depositClampNote?: string;
  };
};

export async function createCheckoutOrder(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  // Phase 3b — multi-item cart. When the form carries a `cart_json`
  // field (a JSON array of per-item selections), the WHOLE cart is
  // checked out as ONE order: one deposit, one delivery fee, one
  // confirmation. Delegate to the dedicated multi-item flow and leave
  // the single-product path below UNCHANGED (byte-for-byte) so the
  // existing "Book Now" checkout can't regress.
  if (formData.has("cart_json")) {
    return createMultiItemCheckoutOrder(formData);
  }

  // Capture what the customer typed up front so every error path can
  // echo it back. Without this round-trip, useActionState re-mounts
  // the form with empty inputs after each failed submit and the
  // customer has to retype every field just because (e.g.) the ZIP
  // wasn't in our coverage area. That's a conversion-killer.
  const submittedValues = {
    firstName: String(formData.get("first_name") ?? ""),
    lastName: String(formData.get("last_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    line1: String(formData.get("line1") ?? ""),
    line2: String(formData.get("line2") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    postalCode: String(formData.get("postal_code") ?? ""),
    eventDate: String(formData.get("event_date") ?? ""),
    startTime: String(formData.get("start_time") ?? ""),
    endTime: String(formData.get("end_time") ?? ""),
    rentalEndDate: String(formData.get("rental_end_date") ?? ""),
  };

  // Closure helper so every ok: false path echoes the submittedValues
  // back to the client. Eliminates the conversion-killer where the
  // form mounts empty after each error and the customer has to retype
  // first name, last name, phone, email, address, city, and state
  // because of (e.g.) an out-of-coverage ZIP.
  const fail = (
    extra: Omit<CheckoutActionState, "submittedValues" | "ok"> & { message: string },
  ): CheckoutActionState => ({
    ok: false,
    ...extra,
    submittedValues
  });

  const termsAccepted = formData.has("terms_accepted");
  if (!termsAccepted) {
    return fail({
      message: "You must agree to the rental terms to place a booking."
    });
  }

  const smsOptIn = formData.get("sms_opt_in") === "true";
  // Phase 2e.13 — per-unit pricing reads `units` outside the zod
  // schema; it's only meaningful when the product carries
  // pricing.per-unit, and the dispatch branch below clamps + truncates
  // via computePerUnitLineTotal so a crafted negative or fractional
  // value can't slip through.
  const rawUnits = String(formData.get("units") ?? "");
  const requestedUnits = /^\d+$/.test(rawUnits) ? parseInt(rawUnits, 10) : 1;
  // Phase 2e.12 — variant id read outside the zod schema. UUID-shaped
  // string only; anything else falls back to null and no variant
  // delta is applied. The submit-time lookup validates the variant
  // actually belongs to the product so a crafted id from another org
  // can't surface.
  const rawVariantId = String(formData.get("selected_variant_id") ?? "");
  const requestedVariantId =
    /^[0-9a-f-]{36}$/i.test(rawVariantId) ? rawVariantId : null;
  // Phase 2e.10 — composition.add-ons selections, encoded as
  // "id:qty,id:qty". Parsed defensively here; unknown ids and zero
  // qtys are silently dropped, and the product-scoped lookup below
  // is the actual security gate.
  const rawAddons = String(formData.get("addons") ?? "");
  const requestedAddons: { addonProductId: string; quantity: number }[] = (() => {
    if (!rawAddons) return [];
    return rawAddons
      .split(",")
      .map((entry) => {
        const [id, qty] = entry.split(":");
        if (!/^[0-9a-f-]{36}$/i.test(id ?? "") || !/^\d+$/.test(qty ?? "")) {
          return null;
        }
        const q = parseInt(qty, 10);
        return q > 0 ? { addonProductId: id, quantity: q } : null;
      })
      .filter((x): x is { addonProductId: string; quantity: number } => x !== null);
  })();
  const requestHeaders = await headers();
  const { getTrustedClientIp } = await import("@/lib/security/request-client");
  const trustedIp = getTrustedClientIp(requestHeaders);
  const clientIp = trustedIp === "unknown" ? null : trustedIp;

  const parsed = checkoutOrderSchema.safeParse({
    firstName: String(formData.get("first_name") ?? ""),
    lastName: String(formData.get("last_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    line1: String(formData.get("line1") ?? ""),
    line2: String(formData.get("line2") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    postalCode: String(formData.get("postal_code") ?? ""),
    eventDate: String(formData.get("event_date") ?? ""),
    startTime: String(formData.get("start_time") ?? ""),
    endTime: String(formData.get("end_time") ?? ""),
    productSlug: String(formData.get("product_slug") ?? ""),
    selectedMode: String(formData.get("selected_mode") ?? ""),
    fulfillmentType: String(formData.get("fulfillment_type") ?? "delivery"),
    rentalEndDate: String(formData.get("rental_end_date") ?? ""),
    idempotencyKey: String(formData.get("idempotency_key") ?? "")
  });

  if (!parsed.success) {
    const fieldErrors: CheckoutFieldErrors = {};
    const fieldMap: Record<string, keyof CheckoutFieldErrors> = {
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      line1: "line1",
      city: "city",
      state: "state",
      postalCode: "postalCode",
      eventDate: "eventDate",
    };
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && key in fieldMap) {
        const mapped = fieldMap[key];
        if (!fieldErrors[mapped]) {
          fieldErrors[mapped] = issue.message;
        }
      }
    }
    return fail({
      message:
        parsed.error.issues[0]?.message ?? "Please review your checkout details.",
      fieldErrors,
    });
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    line1,
    line2,
    city,
    state,
    postalCode,
    eventDate,
    startTime,
    endTime,
    productSlug,
    fulfillmentType,
    rentalEndDate,
    idempotencyKey: rawIdempotencyKey,
    selectedMode: rawSelectedMode,
  } = parsed.data;
  const idempotencyKey = rawIdempotencyKey && rawIdempotencyKey.length > 0 ? rawIdempotencyKey : null;
  const requestedMode: "dry" | "wet" | null =
    rawSelectedMode === "dry" || rawSelectedMode === "wet" ? rawSelectedMode : null;

  try {
    const clientKey = await getActionClientKey();
    const [clientLimit, emailLimit] = await Promise.all([
      enforceRateLimit({
        scope: "checkout:client",
        actor: clientKey,
        limit: 8,
        windowSeconds: 3600,
        strict: true
      }),
      enforceRateLimit({
        scope: "checkout:email",
        actor: email,
        limit: 5,
        windowSeconds: 3600,
        strict: true
      }),
    ]);

    if (!clientLimit.allowed || !emailLimit.allowed) {
      await logAppEvent({
        source: "checkout.website",
        action: "rate_limited",
        status: "warning"
      });

      return fail({
      message: "Too many checkout attempts. Please wait a bit and try again.",
      });
    }
  } catch (error) {
    await logAppError({
      source: "checkout.website",
      message: "Checkout rate limit check failed",
      stack: error instanceof Error ? error.stack : undefined,
      error
    });

    return fail({
      message: "Unable to process checkout right now. Please try again shortly.",
    });
  }

  if (!hasSupabaseEnv()) {
    // A DEPLOYED checkout with no database must never tell the customer
    // their order succeeded — that's a silent lost booking with no charge.
    // Fail loudly here; only local `next dev` keeps the demo-success path.
    const { isProductionRuntime } = await import("@/lib/env/demo-mode");
    if (isProductionRuntime()) {
      console.error(
        "[checkout] CRITICAL: hasSupabaseEnv() is false on a deployed runtime — refusing to fake order success. Check NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
      return fail({
        message: "Checkout is temporarily unavailable. Please try again shortly.",
      });
    }
    const orderNumber = createOrderNumber("DEMO");
    return {
      ok: true,
      message: `Demo mode: Order ${orderNumber} would be created. Add Supabase env vars to create live orders.`,
      orderNumber,
    };
  }

  const orgId = await getPublicOrgId();

  // Block writes on demo org before any DB side effects
  const { blockDemoWrites } = await import("@/lib/demo/guard");
  const demoCheck = await blockDemoWrites(orgId);
  if (demoCheck.blocked) {
    return fail({ message: demoCheck.message });
  }

  // Idempotency replay: if the client sent a key we've already seen
  // for this org (browser retried a successful submission whose
  // response was lost), return the original order's number instead of
  // starting a new one. Skipped when no key — the rate limiter still
  // covers older clients.
  if (orgId && idempotencyKey) {
    const { createSupabaseAdminClient: createAdmin, hasSupabaseServiceRoleEnv: hasSrk } = await import("@/lib/supabase/admin");
    const replaySupabase = hasSrk() ? createAdmin() : await createSupabaseServerClient();
    const { data: replay } = await replaySupabase
      .from("orders")
      .select("order_number")
      .eq("organization_id", orgId)
      .eq("idempotency_key", idempotencyKey)
      .is("deleted_at", null)
      .maybeSingle();
    if (replay?.order_number) {
      return {
        ok: true,
        message: "Your booking is already in. Showing your existing order.",
        orderNumber: replay.order_number,
      };
    }
  }

  if (!orgId) {
    await logAppError({
      source: "checkout.website",
      message: "Public checkout missing organization context"
    });

    return fail({
      message:
        "No organization found. An operator must complete onboarding first.",
    });
  }

  // The public checkout runs anonymously, so the cookie-bound RLS-scoped
  // client can't see (or RETURNING-fetch back) the customer / address / order
  // / order_items rows it inserts on behalf of the storefront tenant — the
  // existing anon INSERT policies allow the write but not the RETURNING via
  // PostgREST. Use the admin client when available; org isolation is enforced
  // explicitly by .eq("organization_id", orgId) on every read and the
  // organization_id field on every insert. orgId itself is derived from
  // getPublicOrgId() (host-resolved, trusted server-side).
  const supabase = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();

  // Service area lookup is only required for delivery orders.
  // Pickup orders skip it and carry zero delivery fee.
  let serviceArea: Awaited<ReturnType<typeof resolveServiceAreaForAddress>> | null = null;
  if (fulfillmentType === "delivery") {
    if (!line1 || !city || !state || !postalCode) {
      return fail({ message: "Delivery address is required for delivery orders." });
    }
    serviceArea = await resolveServiceAreaForAddress({
      organizationId: orgId,
      postalCode,
      city,
      state
    });

    if (!serviceArea) {
      await logAppEvent({
        organizationId: orgId,
        source: "checkout.website",
        action: "service_area_not_found",
        status: "warning",
        metadata: { postalCode, city, state }
      });

      return fail({
      message:
          "We do not currently serve that delivery area. Please enter a ZIP code within a configured service area.",
      });
    }
  }

  // Phase 3a — the per-item pricing / resolution block (single product
  // lookup, pricing dispatch, attendant overage, add-ons, variant delta,
  // wet upcharge, damage waiver) now lives in priceAndResolveOneItem so
  // it can be reused per-line by the multi-item cart. Behavior is
  // identical to the inline block it replaced; the outputs are
  // destructured into the SAME local names the rest of this action
  // already reads, so everything downstream is untouched.
  //
  // PR-2c — the damage-waiver accept checkbox arrives as form field
  // `damage_waiver` ("on" when ticked); read here and passed in.
  const waiverAccepted =
    String(formData.get("damage_waiver") ?? "").toLowerCase() === "on";
  const { priceAndResolveOneItem } = await import("@/lib/checkout/pricing-helpers");
  const itemPricing = await priceAndResolveOneItem(supabase, orgId, {
    productSlug,
    requestedMode,
    requestedUnits,
    requestedVariantId,
    requestedAddons,
    eventDate,
    rentalEndDate,
    startTime,
    endTime,
    waiverAccepted,
  });

  // Decision 2.9 — missing-price gate. The helper returns the exact
  // customer-facing message + the log event the action used to emit
  // inline, so the error shape is identical to before.
  if (!itemPricing.ok) {
    await logAppEvent({
      organizationId: orgId,
      source: "checkout.website",
      action: itemPricing.logEvent.action,
      status: itemPricing.logEvent.status,
      metadata: itemPricing.logEvent.metadata,
    });
    return fail({ message: itemPricing.message });
  }

  // Destructure into the SAME local names the rest of the action reads.
  // `subtotal` stays mutable — downstream code does not reassign it, but
  // keeping it `let` matches the original declaration and avoids churn.
  let subtotal = itemPricing.subtotal;
  const {
    productId,
    productName,
    itemRentalDays,
    itemRatePerDay,
    billedHoursForLineItem,
    billedUnitsForLineItem,
    productMinimumOrderCents,
    productMinimumOrderQuantity,
    orderMinimumCapabilityActive,
    attendantOverageHours,
    resolvedVariantId,
    resolvedAddonLines,
    productVerticalSlug,
    effectiveMode,
    wetUpchargeApplied,
    waiver,
  } = itemPricing;

  // Decision 2.9 — reject zero-total bookings instead of letting them through
  // and surprising the operator with a $0 order. Hit when no productSlug was
  // provided AND the wet upcharge path didn't fire.
  if (subtotal <= 0) {
    return fail({
      message:
        "We couldn't determine pricing for this booking. Please reopen the product page and try again.",
    });
  }

  // Phase 2e.14 — order.minimum-order capability gate. Runs before the
  // service-area minimum so the customer gets the most specific message
  // (product unit minimum > category dollar minimum > service-area
  // minimum). Helpers clamp shortfalls to non-negative.
  if (orderMinimumCapabilityActive) {
    const { enforceOrderMinimum, enforceProductMinQuantity } = await import(
      "@/lib/capabilities/order/minimum-order"
    );
    if (productMinimumOrderQuantity && billedUnitsForLineItem !== null) {
      const qtyCheck = enforceProductMinQuantity(
        billedUnitsForLineItem,
        productMinimumOrderQuantity,
      );
      if (!qtyCheck.ok) {
        await logAppEvent({
          organizationId: orgId,
          source: "checkout.website",
          action: "minimum_quantity_blocked",
          status: "warning",
          metadata: {
            productId,
            billedUnits: billedUnitsForLineItem,
            minimumQuantity: productMinimumOrderQuantity,
          },
        });
        return fail({
          message: `This item requires a minimum of ${productMinimumOrderQuantity} units. Please add ${qtyCheck.shortByUnits} more to continue.`,
        });
      }
    }
    if (productMinimumOrderCents && productMinimumOrderCents > 0) {
      const subtotalCents = Math.round(subtotal * 100);
      const dollarCheck = enforceOrderMinimum(
        subtotalCents,
        productMinimumOrderCents,
      );
      if (!dollarCheck.ok) {
        const minDollars = (productMinimumOrderCents / 100).toFixed(2);
        const shortDollars = (dollarCheck.shortByCents / 100).toFixed(2);
        await logAppEvent({
          organizationId: orgId,
          source: "checkout.website",
          action: "minimum_order_blocked",
          status: "warning",
          metadata: {
            subtotalCents,
            minimumOrderCents: productMinimumOrderCents,
            source: "category",
          },
        });
        return fail({
          message: `This category requires a minimum order of $${minDollars}. Please add $${shortDollars} more to continue.`,
        });
      }
    }
  }

  // PR-3b — per-category minimum OVERRIDES the service-area minimum
  // when set, so a Tables & Chairs operator can publish "$30 minimum
  // per chair order" without inheriting their inflatable side's $100
  // service-area floor. When the category min is null, fall back to
  // the service-area min — the historical behavior.
  if (serviceArea) {
    const effectiveMin =
      typeof productMinimumOrderCents === "number" && productMinimumOrderCents > 0
        ? productMinimumOrderCents / 100
        : serviceArea.minimumOrderAmount;
    if (subtotal < effectiveMin) {
      const source =
        typeof productMinimumOrderCents === "number" && productMinimumOrderCents > 0
          ? "category"
          : "service_area";
      await logAppEvent({
        organizationId: orgId,
        source: "checkout.website",
        action: "minimum_order_blocked",
        status: "warning",
        metadata: {
          subtotal,
          effectiveMinimum: effectiveMin,
          minimumSource: source,
          serviceAreaId: serviceArea?.id ?? null,
        }
      });

      return fail({
        message:
          source === "category"
            ? `This category requires a minimum order of $${effectiveMin.toFixed(2)}.`
            : `This service area requires a minimum order of $${effectiveMin.toFixed(2)}.`,
      });
    }
  }

  // Event date is required when a specific product is being booked
  if (productId && !eventDate) {
    return fail({ message: "Please select an event date to check availability." });
  }

  // Reject a reversed multi-day range up front. Earlier code (~line 339)
  // only entered the per-day pricing branch when rentalEndDate >= eventDate;
  // a customer entering "Jun 15 to Jun 10" was silently charged for one day.
  // Hard-fail with a clear message instead.
  if (eventDate && rentalEndDate && rentalEndDate < eventDate) {
    return fail({
      message: "Rental end date must be on or after the event date.",
    });
  }

  // Enforce booking date policies (lead time and max advance).
  // event_date is a YYYY-MM-DD calendar day; we compare it to the calendar
  // day that's `lead_time_hours` from now, not to "now" directly — otherwise
  // any same-day booking fails even when lead_time = 0, because midnight UTC
  // of "today" is in the past once the day has started.
  if (eventDate) {
    const bookingPolicies = await getBookingPolicies();
    // PR-2b — vertical lead-time floor: a tent build needs weeks of
    // notice regardless of the org's generic 24h setting. Effective
    // lead time = max(org policy, vertical floor); the org can be
    // stricter than the vertical, never looser.
    const { resolveVerticalPolicies, effectiveLeadTimeHours } = await import(
      "@/lib/verticals/policies"
    );
    const verticalPolicies = resolveVerticalPolicies(productVerticalSlug);
    const leadTimeHours = effectiveLeadTimeHours(
      bookingPolicies.bookingLeadTimeHours,
      verticalPolicies
    );
    const eventDateMs = new Date(`${eventDate}T00:00:00Z`).getTime();
    const nowMs = Date.now();
    const leadTimeMs = leadTimeHours * 60 * 60 * 1000;
    const earliestMs = nowMs + leadTimeMs;
    // Round earliestMs down to the start of that UTC day so a calendar-day
    // comparison vs eventDateMs (also at 00:00 UTC) is fair.
    const earliestDayMs = new Date(earliestMs).setUTCHours(0, 0, 0, 0);
    const maxDateMs = nowMs + bookingPolicies.maxAdvanceBookingDays * 24 * 60 * 60 * 1000;

    if (eventDateMs < earliestDayMs) {
      const friendly =
        leadTimeHours === 0
          ? "This event date has already passed."
          : leadTimeHours >= 48
            ? `Bookings for this item require at least ${Math.round(leadTimeHours / 24)} days advance notice.`
            : `Bookings require at least ${leadTimeHours} hours advance notice.`;
      return fail({ message: friendly });
    }

    if (eventDateMs > maxDateMs) {
      return fail({
      message: `Bookings cannot be more than ${bookingPolicies.maxAdvanceBookingDays} days in advance.`,
      });
    }
  }

  if (productId && eventDate) {
    const availability = await checkProductAvailability({
      organizationId: orgId,
      productId,
      eventDate,
      startTime,
      endTime,
      rentalEndDate,
      // Per-unit products consume the ordered count against pooled
      // capacity; everything else reserves a single unit.
      requestedQuantity: billedUnitsForLineItem ?? 1,
    });

    if (!availability.available) {
      await logAppEvent({
        organizationId: orgId,
        source: "checkout.website",
        action: "availability_blocked",
        status: "warning",
        metadata: {
          productId,
          eventDate,
        }
      });

      return fail({
      message:
          availability.reason ??
          "This rental is not available for the selected date.",
      });
    }
  }

  let customerId: string;
  let newCustomerId: string | null = null; // set only when we INSERT a brand-new customer

  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone")
    .eq("organization_id", orgId)
    .ilike("email", email)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (existingCustomer) {
    customerId = existingCustomer.id;

    // Only fill blank fields — never overwrite data the operator already has on record
    const customerUpdates: Record<string, unknown> = {};
    if (firstName && !existingCustomer.first_name) customerUpdates.first_name = firstName;
    if (lastName && !existingCustomer.last_name) customerUpdates.last_name = lastName;
    if (phone && !existingCustomer.phone) customerUpdates.phone = phone;
    if (smsOptIn) {
      customerUpdates.sms_opt_in = true;
      customerUpdates.sms_opt_in_at = new Date().toISOString();
      customerUpdates.sms_opt_in_ip = clientIp;
    }

    const { error: updateCustomerError } = Object.keys(customerUpdates).length > 0
      ? await supabase
          .from("customers")
          .update(customerUpdates)
          .eq("id", customerId)
          .eq("organization_id", orgId)
          .is("deleted_at", null)
      : { error: null };

    if (updateCustomerError) {
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to update existing customer during checkout",
        context: { customerId, reason: updateCustomerError.message }
      });

      return fail({
      message: "We couldn't update your contact details. Please try again or contact the operator.",
      });
    }
  } else {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({
        organization_id: orgId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone ?? null,
        sms_opt_in: smsOptIn,
        sms_opt_in_at: smsOptIn ? new Date().toISOString() : null,
        sms_opt_in_ip: smsOptIn ? clientIp : null
      })
      .select("id")
      .single();

    if (customerError?.code === "23505") {
      // Race: another concurrent checkout for the same email won the
      // unique (organization_id, email) insert milliseconds before us.
      // Re-SELECT and continue rather than failing the customer with a
      // generic "couldn't create your account" message.
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("organization_id", orgId)
        .ilike("email", email)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      if (!existing) {
        await logAppError({
          organizationId: orgId,
          source: "checkout.website",
          message: "Customer insert hit unique constraint but re-SELECT found no row",
          context: { reason: customerError.message }
        });
        return fail({ message: "We couldn't create your account. Please try again." });
      }
      customerId = existing.id;
      // Don't set newCustomerId — the other request owns the row, we
      // shouldn't rollback-delete it on later failure.
    } else if (customerError || !customer) {
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to create customer during checkout",
        context: { reason: customerError?.message }
      });

      return fail({
      message: "We couldn't create your account. Please try again.",
      });
    } else {
      customerId = customer.id;
      newCustomerId = customer.id;
    }
  }

  let deliveryAddressId: string | null = null;
  if (fulfillmentType === "delivery") {
    const { data: address, error: addressError } = await supabase
      .from("customer_addresses")
      .insert({
        customer_id: customerId,
        organization_id: orgId,
        label: "Delivery",
        line1,
        line2: line2 || null,
        city,
        state,
        postal_code: postalCode,
        is_default_delivery: true
      })
      .select("id")
      .single();

    if (addressError || !address) {
      if (newCustomerId) {
        await supabase.from("customers").delete().eq("id", newCustomerId).eq("organization_id", orgId);
      }

      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to create address during checkout",
        context: { reason: addressError?.message, customerId }
      });

      return fail({
      message: "We couldn't save your delivery address. Please check the address and try again.",
      });
    }

    deliveryAddressId = address.id;
  }

  const deliveryFee = serviceArea?.deliveryFee ?? 0;

  // Tax is computed off the taxable base (subtotal + delivery_fee) by
  // looking up the operator's per-jurisdiction rule for the delivery
  // address. A missing rule returns 0 — operators opt in by configuring
  // jurisdictions they actually collect tax in. Pickup orders without
  // a delivery address fall through to 0 as well.
  const taxableBaseCents = Math.round((subtotal + deliveryFee) * 100);
  const taxResult = await computeOrderTax(supabase, {
    organizationId: orgId,
    state: fulfillmentType === "delivery" ? state ?? null : null,
    postalCode: fulfillmentType === "delivery" ? postalCode ?? null : null,
    taxableBaseCents,
  });
  const taxCents = taxResult.taxCents;
  const taxAmount = taxCents / 100;

  // Compute deposit + balance in cents-integers to avoid the accumulated
  // toFixed(2) rounding drift that the previous chain — subtotal+fee
  // rounded, then *percentage rounded — could produce on multi-line
  // totals. Example: subtotal 99.99 + fee 100.00 + 30% deposit
  // previously yielded deposit 59.99 + balance 140.00 = 199.99 (≠ 200).
  // Working in cents until the final boundary keeps deposit+balance
  // equal to total to the penny.
  const totalCents = taxableBaseCents + taxCents;
  const total = totalCents / 100;

  const policies = await getBookingPolicies();
  let depositCents = Math.round(totalCents * (policies.depositPercentage / 100));
  if (policies.depositMinimum !== null) {
    const minimumCents = Math.round(policies.depositMinimum * 100);
    if (depositCents < minimumCents) depositCents = minimumCents;
  }
  // Clamp to total — the operator may have a depositMinimum exceeding
  // a small order; charging more than the total is invalid. Previously
  // this clamp was silent; we now also surface a structured warning so
  // operators can spot the misconfiguration.
  let depositClampNote: string | undefined;
  if (depositCents > totalCents) {
    const configuredCents = depositCents;
    depositCents = totalCents;
    depositClampNote = `Deposit shown is your order total ($${(totalCents / 100).toFixed(
      2
    )}). The configured minimum ($${(configuredCents / 100).toFixed(
      2
    )}) exceeds the order total, so the deposit was reduced.`;
    await logAppEvent({
      organizationId: orgId,
      source: "checkout.website",
      action: "deposit_minimum_clamped",
      status: "warning",
      metadata: {
        total_cents: totalCents,
        configured_minimum: policies.depositMinimum,
        configured_percentage: policies.depositPercentage,
      }
    });
  }
  const deposit = depositCents / 100;
  const balance = (totalCents - depositCents) / 100;

  // Connect Express — deposits are charged DIRECTLY on the operator's
  // connected account (Korent never holds operator funds; see the
  // decision record in docs/marketplace/master-plan.md). Online
  // payment therefore requires a charges_enabled connected account,
  // not just the platform STRIPE_SECRET_KEY. When the org isn't
  // connected yet, the order falls through to the no-Stripe path
  // (deposit recorded as due, operator collects manually) and the
  // dashboard readiness banner tells them to finish onboarding.
  const { canAcceptStripePayments, fieldsFromOrgRow, ORG_CONNECT_COLUMNS } = await import("@/lib/stripe/connect");
  const { data: connectRow } = await supabase
    .from("organizations")
    .select(`${ORG_CONNECT_COLUMNS}, default_currency`)
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  const connectReady = canAcceptStripePayments(fieldsFromOrgRow(connectRow ?? null));
  const stripeAccountId = connectRow?.stripe_connect_account_id ?? null;

  // Check Stripe plan gate before creating any records — fail early if org can't accept
  // online payments but a deposit is required.
  if (hasStripeEnv() && connectReady && deposit > 0) {
    const { checkFeatureAccess } = await import("@/lib/stripe/gate");
    const stripeGate = await checkFeatureAccess("stripe_payments");
    if (!stripeGate.allowed) {
      return fail({
      message: stripeGate.reason ?? "Online payments are not available on your current plan.",
      });
    }
  }

  const orderNumber = createOrderNumber();

  // Operator's wall-clock event times are stored directly as TIME
  // (event_start_local / event_end_local). The DB trigger
  // orders_sync_event_times_trg composes event_start_time
  // (timestamptz) by combining (event_date + local time) at the org's
  // event_timezone, so downstream readers get the correct UTC instant
  // without the app needing a tz library here.
  //
  // The legacy `${eventDate}T${startTime}:00.000Z` pattern stored the
  // wall-clock AS a UTC timestamp, which was wrong for any non-UTC
  // org. We no longer set event_start_time directly; the trigger
  // computes it.
  const eventStartLocal = eventDate && startTime ? `${startTime}:00` : null;
  const eventEndLocal = eventDate && endTime ? `${endTime}:00` : null;

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      organization_id: orgId,
      customer_id: customerId,
      order_number: orderNumber,
      order_status: policies.requireDepositToConfirm ? "awaiting_deposit" : "confirmed",
      event_date: eventDate ?? null,
      event_start_local: eventStartLocal,
      event_end_local: eventEndLocal,
      rental_end_date: rentalEndDate ?? null,
      delivery_address_id: deliveryAddressId,
      fulfillment_type: fulfillmentType,
      subtotal_amount: subtotal,
      delivery_fee_amount: deliveryFee,
      tax_amount: taxAmount,
      total_amount: total,
      deposit_due_amount: deposit,
      balance_due_amount: balance,
      source_channel: "website",
      terms_accepted_at: new Date().toISOString(),
      notes: serviceArea ? `Service area: ${serviceArea.label}` : null,
      idempotency_key: idempotencyKey
    })
    .select("id")
    .single();

  // Concurrent retry hit the unique (org, idempotency_key) index between
  // our SELECT replay check above and the INSERT here. Return the
  // already-created order's response instead of failing the user.
  if (orderError?.code === "23505" && idempotencyKey) {
    const { data: raced } = await supabase
      .from("orders")
      .select("order_number")
      .eq("organization_id", orgId)
      .eq("idempotency_key", idempotencyKey)
      .is("deleted_at", null)
      .maybeSingle();
    if (raced?.order_number) {
      // Don't roll back the address / customer — the other request
      // owns them and is currently mid-flight or just committed.
      return {
        ok: true,
        message: "Your booking is already in. Showing your existing order.",
        orderNumber: raced.order_number,
      };
    }
  }

  if (orderError || !order) {
    if (deliveryAddressId) {
      await supabase.from("customer_addresses").delete().eq("id", deliveryAddressId).eq("customer_id", customerId);
    }
    if (newCustomerId) {
      await supabase.from("customers").delete().eq("id", newCustomerId).eq("organization_id", orgId);
    }

    await logAppError({
      organizationId: orgId,
      source: "checkout.website",
      message: "Failed to create order during checkout",
      context: { reason: orderError?.message, customerId, orderNumber }
    });

    return fail({
      message: "We couldn't create your booking. Please try again or contact the operator.",
    });
  }

  if (productId) {
    // Phase 3a — the parent rental insert + its add-on and damage-waiver
    // child inserts now live in insertOneItemLines so the multi-item cart
    // can reuse them per line. Behavior is identical: the parent insert is
    // the only failable step (it rolls back order/address/customer below,
    // exactly as before), while the add-on and waiver inserts are
    // best-effort and self-log inside the helper.
    const { insertOneItemLines } = await import("@/lib/checkout/insert-helpers");
    const insertResult = await insertOneItemLines(supabase, {
      organizationId: orgId,
      orderId: order.id,
      productId,
      productName,
      subtotal,
      itemRatePerDay,
      itemRentalDays,
      billedUnitsForLineItem,
      billedHoursForLineItem,
      attendantOverageHours,
      effectiveMode,
      resolvedVariantId,
      resolvedAddonLines,
      waiver,
    });

    if (!insertResult.ok) {
      try {
        await supabase.from("orders").delete().eq("id", order.id).eq("organization_id", orgId);
        if (deliveryAddressId) {
          await supabase.from("customer_addresses").delete().eq("id", deliveryAddressId).eq("customer_id", customerId);
        }
        if (newCustomerId) {
          await supabase.from("customers").delete().eq("id", newCustomerId).eq("organization_id", orgId);
        }
      } catch (cleanupErr) {
        console.error("[checkout] Cleanup after item insert failure failed:", cleanupErr instanceof Error ? cleanupErr.message : cleanupErr, "orderId:", order.id);
      }

      return fail({
      message: "We couldn't save your booking line items. Please try again.",
      });
    }
  }

  // Use a temporary checkout_hold only when Stripe payment is expected (webhook will convert it).
  // If Stripe isn't configured, use a permanent hold since there's no webhook to convert it.
  const willUseStripe = hasStripeEnv() && connectReady && deposit > 0;

  if (productId && eventDate) {
    const reserveResult = await reserveProductAvailabilityBlock({
      organizationId: orgId,
      productId,
      orderId: order.id,
      eventDate,
      startTime,
      endTime,
      rentalEndDate,
      source: willUseStripe ? "checkout" : "dashboard",
      quantity: billedUnitsForLineItem ?? 1,
    });

    if (!reserveResult.ok) {
      // Decision 2.7 — the reserve RPC is the source of truth (advisory
      // lock + atomic insert), so a reserve failure means another
      // checkout won the race for the slot. Roll back the order and the
      // side-rows we created on the way in. Each delete is awaited
      // INDIVIDUALLY so a single failure doesn't short-circuit the
      // others — if one fails, we still try the rest and log every
      // failure so operators can clean up.
      const cleanupFailures: string[] = [];
      try {
        const { error } = await supabase
          .from("orders")
          .delete()
          .eq("id", order.id)
          .eq("organization_id", orgId);
        if (error) cleanupFailures.push(`orders: ${error.message}`);
      } catch (err) {
        cleanupFailures.push(
          `orders: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      if (deliveryAddressId) {
        try {
          const { error } = await supabase
            .from("customer_addresses")
            .delete()
            .eq("id", deliveryAddressId)
            .eq("customer_id", customerId);
          if (error)
            cleanupFailures.push(`customer_addresses: ${error.message}`);
        } catch (err) {
          cleanupFailures.push(
            `customer_addresses: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }
      if (newCustomerId) {
        try {
          const { error } = await supabase
            .from("customers")
            .delete()
            .eq("id", newCustomerId)
            .eq("organization_id", orgId);
          if (error) cleanupFailures.push(`customers: ${error.message}`);
        } catch (err) {
          cleanupFailures.push(
            `customers: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // Failure context now includes BOTH the original reserve reason and
      // any cleanup failures, so operators monitoring app_events can spot
      // orphan rows that need manual removal.
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message:
          cleanupFailures.length > 0
            ? "Reserve failed and cleanup also failed — orphan rows possible"
            : "Failed to reserve availability block during checkout",
        context: {
          reason: reserveResult.message,
          orderId: order.id,
          productId,
          eventDate,
          cleanupFailures: cleanupFailures.length > 0 ? cleanupFailures : undefined,
        }
      });

      return fail({
      message:
          reserveResult.message ??
          "Unable to reserve availability for the selected date.",
      });
    }
  }

  await logAppEvent({
    organizationId: orgId,
    source: "checkout.website",
    action: "order_created",
    status: "success",
    metadata: {
      orderId: order.id,
      orderNumber,
      productId,
      serviceAreaId: serviceArea?.id ?? null,
      eventDate,
    }
  });

  try {
    const { markSetupStep } = await import("@/lib/guidance/update-setup-progress");
    await markSetupStep(orgId, "has_first_order");
  } catch { /* non-critical */ }

  // Send order confirmation email only when no Stripe deposit is required.
  // When Stripe handles the deposit, the webhook sends a payment confirmation
  // after checkout.session.completed to avoid emailing before the customer pays.
  const stripeWillHandlePayment = hasStripeEnv() && connectReady && deposit > 0;
  if (!stripeWillHandlePayment) {
    try {
      const { triggerOrderConfirmationEmail } = await import("@/lib/email/triggers");
      await triggerOrderConfirmationEmail({
        organizationId: orgId,
        customerFirstName: firstName,
        customerEmail: email,
        orderNumber,
        productName,
        eventDate: eventDate ?? "",
        subtotal,
        deliveryFee,
        total,
        depositDue: deposit
      });
    } catch (err) {
      // #407 preserve the actual error so we can diagnose; the form
      // continues regardless (customer has already paid in the success path).
      // Also route to logAppError so the failure lands in app_error_logs +
      // Sentry, not just stdout.
      console.error("[checkout] confirmation email failed for", orderNumber, err instanceof Error ? err.message : err);
      const { logAppError } = await import("@/lib/observability/server");
      await logAppError({
        organizationId: orgId,
        source: "checkout",
        message: "order confirmation email failed (order already committed)",
        route: "checkout",
        context: { order_number: orderNumber, recipient: email },
        error: err
      });
    }
  }

  if (phone && smsOptIn) {
    try {
      const { sendSmsNotification } = await import("@/lib/sms/send-notification");
      const { createSupabaseServerClient: createSB } = await import("@/lib/supabase/server");
      const sb = await createSB();
      const { data: org } = await sb
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .is("deleted_at", null)
        .maybeSingle();
      await sendSmsNotification("orderConfirmation", phone, {
        orderNumber,
        businessName: org?.name ?? "Your rental company",
      }, orgId, { orderId: order.id, customerId });
    } catch (smsErr) {
      // Non-critical — email confirmation already sent — but log centrally
      // so SMS provider misconfig is visible in production.
      console.error("[checkout] confirmation SMS failed for", orderNumber, smsErr instanceof Error ? smsErr.message : smsErr);
    }
  }

  // Attempt Stripe Checkout for deposit payment — created as a DIRECT
  // charge on the operator's connected account (Connect Express).
  // The customer pays the operator; the operator pays Stripe's fees;
  // Korent takes no application fee (Option A — subscription only).
  if (willUseStripe && stripeAccountId) {
    try {
      // Verify the org's plan allows Stripe payments before creating a session
      const { checkFeatureAccess } = await import("@/lib/stripe/gate");
      const stripeGate = await checkFeatureAccess("stripe_payments");
      if (!stripeGate.allowed) {
        return fail({
      message: stripeGate.reason ?? "Online payments are not available on your current plan.",
        });
      }

      const stripe = getStripe();
      // Use the request origin so the customer is redirected back to the
      // tenant subdomain / custom domain they checked out on, not the root
      // marketing domain.
      const { getRequestOrigin } = await import("@/lib/seo/metadata");
      const siteUrl = await getRequestOrigin();

      // Resolve org currency so non-USD operators charge in their currency.
      // Falls back to "usd" if the column is null/missing. The helper
      // applies zero-decimal handling for currencies like JPY. The row
      // was already fetched alongside the connect columns above.
      const { normalizeCurrency, toStripeMinorUnits } = await import("@/lib/money/currency");
      const orgCurrency = normalizeCurrency(connectRow?.default_currency);

      // PR-2c — saved card flow. Create / reuse a connected-account
      // Customer for the renter so `setup_future_usage='on_session'`
      // attaches the payment method to a stable id the operator can
      // charge against post-event for damage. Customer rows are
      // org-scoped (one renter who rents from two operators ends up
      // with two acct-scoped customer ids — the right model for
      // direct charges).
      let customerStripeId: string | null = null;
      try {
        const { data: customerRow } = await supabase
          .from("customers")
          .select("stripe_customer_id")
          .eq("id", customerId)
          .eq("organization_id", orgId)
          .maybeSingle();
        customerStripeId = customerRow?.stripe_customer_id ?? null;
        if (!customerStripeId) {
          const created = await stripe.customers.create(
            {
              email: email ?? undefined,
              name: [firstName, lastName].filter(Boolean).join(" ") || undefined,
              phone: phone ?? undefined,
              metadata: { organization_id: orgId, customer_id: customerId },
            },
            { stripeAccount: stripeAccountId }
          );
          customerStripeId = created.id;
          await supabase
            .from("customers")
            .update({ stripe_customer_id: customerStripeId })
            .eq("id", customerId)
            .eq("organization_id", orgId)
            .is("stripe_customer_id", null);
        }
      } catch (custErr) {
        // Non-fatal — checkout proceeds without saving the card. The
        // operator can still issue manual damage invoices via cash /
        // direct billing.
        await logAppError({
          organizationId: orgId,
          source: "checkout.website.stripe_customer",
          message: "Connected-account customer create failed",
          context: { orderNumber, reason: custErr instanceof Error ? custErr.message : String(custErr) },
        });
      }

      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency: orgCurrency,
                product_data: {
                  name: `Deposit — ${productName}`,
                  description: `Order ${orderNumber} deposit`,
                },
                unit_amount: toStripeMinorUnits(deposit, orgCurrency),
              },
              quantity: 1,
            },
          ],
          customer_email: customerStripeId ? undefined : email,
          customer: customerStripeId ?? undefined,
          // setup_future_usage=on_session attaches the payment method
          // used here to the customer so the operator can charge it
          // for damage after the event without re-collecting a card.
          payment_intent_data: customerStripeId
            ? { setup_future_usage: "on_session" }
            : undefined,
          success_url: `${siteUrl}/order-confirmation?order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/order-confirmation?order=${orderNumber}`,
          metadata: {
            organization_id: orgId,
            order_id: order.id,
            order_number: orderNumber,
            payment_type: "deposit",
          }
        },
        // Direct charge: the session (and its payment_intent, refunds,
        // disputes) lives on the connected account. Webhook events for
        // it arrive with event.account set — the endpoint must have
        // "listen to events on connected accounts" enabled.
        { stripeAccount: stripeAccountId }
      );

      if (session.url) {
        const fmt = (n: number) => `$${n.toFixed(2)}`;
        const addrParts = [line1, city, state, postalCode].filter(Boolean);
        return {
          ok: true,
          message: `Order ${orderNumber} created!`,
          orderNumber,
          stripeUrl: session.url,
          summary: {
            productName,
            eventDate: eventDate ?? "",
            address: addrParts.join(", "),
            // Display the subtotal without the wet upcharge baked in
            // so the review screen's line items add up to the total
            // (Subtotal + Wet upcharge + Delivery fee = Total). The
            // stored subtotal in the DB still includes everything;
            // this is purely for human-readable display arithmetic.
            subtotal: fmt(subtotal - wetUpchargeApplied),
            deliveryFee: fmt(deliveryFee),
            tax: taxAmount > 0 ? fmt(taxAmount) : undefined,
            taxLabel: taxResult.label ?? undefined,
            total: fmt(total),
            depositDue: fmt(deposit),
            balanceDue: fmt(balance),
            wetUpcharge: wetUpchargeApplied > 0 ? fmt(wetUpchargeApplied) : undefined,
            depositClampNote,
          },
        };
      }
    } catch (stripeError) {
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Stripe checkout session creation failed — cancelling order and releasing hold",
        stack: stripeError instanceof Error ? stripeError.stack : undefined,
        context: { orderNumber, deposit },
        error: stripeError
      });
      // Cancel the order and release the checkout hold so inventory isn't locked indefinitely
      try {
        await supabase
          .from("orders")
          .update({ order_status: "cancelled" })
          .eq("id", order.id)
          .eq("organization_id", orgId)
          .eq("order_status", "awaiting_deposit");
        await supabase
          .from("availability_blocks")
          .delete()
          .eq("source_order_id", order.id)
          .eq("organization_id", orgId)
          .eq("block_type", "checkout_hold");
      } catch {
        console.error("[checkout] Failed to cancel order/block after Stripe failure", orderNumber);
      }
      return fail({
      message: "We were unable to process your payment at this time. Please try again or contact us for assistance.",
      });
    }
  }

  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const addrParts = [line1, city, state, postalCode].filter(Boolean);
  return {
    ok: true,
    message: `Order ${orderNumber} created successfully! A deposit of $${deposit.toFixed(
      2
    )} is required to confirm your booking.`,
    orderNumber,
    summary: {
      productName,
      eventDate: eventDate ?? "",
      address: addrParts.join(", "),
      // Same rationale as the Stripe branch above — display subtotal
      // without the wet upcharge so the line items sum to the total.
      subtotal: fmt(subtotal - wetUpchargeApplied),
      deliveryFee: fmt(deliveryFee),
      tax: taxAmount > 0 ? fmt(taxAmount) : undefined,
      taxLabel: taxResult.label ?? undefined,
      total: fmt(total),
      depositDue: fmt(deposit),
      balanceDue: fmt(balance),
      wetUpcharge: wetUpchargeApplied > 0 ? fmt(wetUpchargeApplied) : undefined,
      depositClampNote,
    },
  };
}

/**
 * Phase 3b — combined multi-item checkout.
 *
 * Creates ONE order containing N independent products with ONE deposit,
 * ONE delivery fee, ONE confirmation. Invoked by createCheckoutOrder when
 * a `cart_json` form field is present.
 *
 * Safety invariants (money code — correctness over cleverness):
 *  1. ALL items are priced + validated BEFORE any DB write. If any item
 *     fails pricing, NO order row is created.
 *  2. Order-level math (delivery fee, tax, deposit %, minimum, clamp) is
 *     computed ONCE on the summed subtotal — identical to the single path.
 *  3. The whole order is rolled back (delete order → cascades order_items
 *     + address; delete brand-new customer) on ANY per-item insert OR
 *     reserve failure. No partial orders, ever.
 *  4. The Stripe deposit line uses the SAME integer deposit-cents value
 *     the single path uses, with a sanity assertion that the Stripe
 *     minor-units equal the computed deposit.
 */
export async function createMultiItemCheckoutOrder(
  formData: FormData,
): Promise<CheckoutActionState> {
  const submittedValues = {
    firstName: String(formData.get("first_name") ?? ""),
    lastName: String(formData.get("last_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    line1: String(formData.get("line1") ?? ""),
    line2: String(formData.get("line2") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    postalCode: String(formData.get("postal_code") ?? ""),
    eventDate: String(formData.get("event_date") ?? ""),
    startTime: String(formData.get("start_time") ?? ""),
    endTime: String(formData.get("end_time") ?? ""),
    rentalEndDate: String(formData.get("rental_end_date") ?? ""),
  };

  const fail = (
    extra: Omit<CheckoutActionState, "submittedValues" | "ok"> & { message: string },
  ): CheckoutActionState => ({
    ok: false,
    ...extra,
    submittedValues,
  });

  const termsAccepted = formData.has("terms_accepted");
  if (!termsAccepted) {
    return fail({
      message: "You must agree to the rental terms to place a booking.",
    });
  }

  // Parse + validate the cart BEFORE anything else. Empty / malformed /
  // over-cap carts are rejected with a clear message and never reach the DB.
  const { parseCartJson } = await import("@/lib/checkout/cart-json");
  const cartParse = parseCartJson(String(formData.get("cart_json") ?? ""));
  if (!cartParse.ok) {
    return fail({ message: cartParse.message });
  }
  const cartItems = cartParse.items;

  const smsOptIn = formData.get("sms_opt_in") === "true";
  const requestHeaders = await headers();
  const { getTrustedClientIp } = await import("@/lib/security/request-client");
  const trustedIp = getTrustedClientIp(requestHeaders);
  const clientIp = trustedIp === "unknown" ? null : trustedIp;

  // Order-level fields share the SAME schema the single path uses, minus
  // the single `productSlug` (each item carries its own). We pass an empty
  // product_slug so the order-level zod validation is byte-for-byte the
  // same for contact / address / date / idempotency.
  const parsed = checkoutOrderSchema.safeParse({
    firstName: String(formData.get("first_name") ?? ""),
    lastName: String(formData.get("last_name") ?? ""),
    email: String(formData.get("email") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    line1: String(formData.get("line1") ?? ""),
    line2: String(formData.get("line2") ?? ""),
    city: String(formData.get("city") ?? ""),
    state: String(formData.get("state") ?? ""),
    postalCode: String(formData.get("postal_code") ?? ""),
    eventDate: String(formData.get("event_date") ?? ""),
    startTime: String(formData.get("start_time") ?? ""),
    endTime: String(formData.get("end_time") ?? ""),
    productSlug: "",
    selectedMode: "",
    fulfillmentType: String(formData.get("fulfillment_type") ?? "delivery"),
    rentalEndDate: String(formData.get("rental_end_date") ?? ""),
    idempotencyKey: String(formData.get("idempotency_key") ?? ""),
  });

  if (!parsed.success) {
    const fieldErrors: CheckoutFieldErrors = {};
    const fieldMap: Record<string, keyof CheckoutFieldErrors> = {
      firstName: "firstName",
      lastName: "lastName",
      email: "email",
      phone: "phone",
      line1: "line1",
      city: "city",
      state: "state",
      postalCode: "postalCode",
      eventDate: "eventDate",
    };
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && key in fieldMap) {
        const mapped = fieldMap[key];
        if (!fieldErrors[mapped]) {
          fieldErrors[mapped] = issue.message;
        }
      }
    }
    return fail({
      message:
        parsed.error.issues[0]?.message ?? "Please review your checkout details.",
      fieldErrors,
    });
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    line1,
    line2,
    city,
    state,
    postalCode,
    eventDate,
    startTime,
    endTime,
    fulfillmentType,
    rentalEndDate,
    idempotencyKey: rawIdempotencyKey,
  } = parsed.data;
  const idempotencyKey =
    rawIdempotencyKey && rawIdempotencyKey.length > 0 ? rawIdempotencyKey : null;

  // ── Order-level: rate limiting (once per submit, same scopes/limits) ──
  try {
    const clientKey = await getActionClientKey();
    const [clientLimit, emailLimit] = await Promise.all([
      enforceRateLimit({
        scope: "checkout:client",
        actor: clientKey,
        limit: 8,
        windowSeconds: 3600,
        strict: true,
      }),
      enforceRateLimit({
        scope: "checkout:email",
        actor: email,
        limit: 5,
        windowSeconds: 3600,
        strict: true,
      }),
    ]);

    if (!clientLimit.allowed || !emailLimit.allowed) {
      await logAppEvent({
        source: "checkout.website",
        action: "rate_limited",
        status: "warning",
      });
      return fail({
        message: "Too many checkout attempts. Please wait a bit and try again.",
      });
    }
  } catch (error) {
    await logAppError({
      source: "checkout.website",
      message: "Checkout rate limit check failed",
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });
    return fail({
      message: "Unable to process checkout right now. Please try again shortly.",
    });
  }

  if (!hasSupabaseEnv()) {
    const { isProductionRuntime } = await import("@/lib/env/demo-mode");
    if (isProductionRuntime()) {
      console.error(
        "[checkout] CRITICAL: hasSupabaseEnv() is false on a deployed runtime — refusing to fake order success.",
      );
      return fail({
        message: "Checkout is temporarily unavailable. Please try again shortly.",
      });
    }
    const orderNumber = createOrderNumber("DEMO");
    return {
      ok: true,
      message: `Demo mode: Order ${orderNumber} would be created. Add Supabase env vars to create live orders.`,
      orderNumber,
    };
  }

  const orgId = await getPublicOrgId();

  const { blockDemoWrites } = await import("@/lib/demo/guard");
  const demoCheck = await blockDemoWrites(orgId);
  if (demoCheck.blocked) {
    return fail({ message: demoCheck.message });
  }

  // Idempotency replay (order-level, identical to the single path).
  if (orgId && idempotencyKey) {
    const {
      createSupabaseAdminClient: createAdmin,
      hasSupabaseServiceRoleEnv: hasSrk,
    } = await import("@/lib/supabase/admin");
    const replaySupabase = hasSrk()
      ? createAdmin()
      : await createSupabaseServerClient();
    const { data: replay } = await replaySupabase
      .from("orders")
      .select("order_number")
      .eq("organization_id", orgId)
      .eq("idempotency_key", idempotencyKey)
      .is("deleted_at", null)
      .maybeSingle();
    if (replay?.order_number) {
      return {
        ok: true,
        message: "Your booking is already in. Showing your existing order.",
        orderNumber: replay.order_number,
      };
    }
  }

  if (!orgId) {
    await logAppError({
      source: "checkout.website",
      message: "Public checkout missing organization context",
    });
    return fail({
      message:
        "No organization found. An operator must complete onboarding first.",
    });
  }

  const supabase = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();

  // Service-area lookup (order-level, once — same as the single path).
  let serviceArea: Awaited<ReturnType<typeof resolveServiceAreaForAddress>> | null = null;
  if (fulfillmentType === "delivery") {
    if (!line1 || !city || !state || !postalCode) {
      return fail({ message: "Delivery address is required for delivery orders." });
    }
    serviceArea = await resolveServiceAreaForAddress({
      organizationId: orgId,
      postalCode,
      city,
      state,
    });
    if (!serviceArea) {
      await logAppEvent({
        organizationId: orgId,
        source: "checkout.website",
        action: "service_area_not_found",
        status: "warning",
        metadata: { postalCode, city, state },
      });
      return fail({
        message:
          "We do not currently serve that delivery area. Please enter a ZIP code within a configured service area.",
      });
    }
  }

  // ── STEP 2: Price + validate ALL items BEFORE any DB writes. ──
  // The whole-order damage-waiver checkbox applies to every line that
  // offers a waiver (mirrors the single path's per-product behavior).
  const waiverAccepted =
    String(formData.get("damage_waiver") ?? "").toLowerCase() === "on";
  const { priceAndResolveOneItem } = await import("@/lib/checkout/pricing-helpers");

  type ResolvedItem = Extract<
    Awaited<ReturnType<typeof priceAndResolveOneItem>>,
    { ok: true }
  >;
  const resolved: ResolvedItem[] = [];

  for (const item of cartItems) {
    const itemPricing = await priceAndResolveOneItem(supabase, orgId, {
      productSlug: item.productSlug,
      requestedMode: item.requestedMode,
      requestedUnits: item.requestedUnits,
      requestedVariantId: item.requestedVariantId,
      requestedAddons: item.requestedAddons,
      eventDate,
      rentalEndDate,
      startTime,
      endTime,
      waiverAccepted,
    });

    if (!itemPricing.ok) {
      await logAppEvent({
        organizationId: orgId,
        source: "checkout.website",
        action: itemPricing.logEvent.action,
        status: itemPricing.logEvent.status,
        metadata: { ...itemPricing.logEvent.metadata, cart_item_slug: item.productSlug },
      });
      // No order row exists yet — fail immediately.
      return fail({ message: itemPricing.message });
    }

    // A cart item must resolve to a real, priced product. (The single
    // path tolerates an empty slug → generic $0 booking; a cart line
    // that resolves to no product would silently drop, so reject it.)
    if (!itemPricing.productId || itemPricing.subtotal <= 0) {
      return fail({
        message:
          "We couldn't determine pricing for one of your items. Please reopen your cart and try again.",
      });
    }

    resolved.push(itemPricing);
  }

  // Sum the per-item subtotals into the single order subtotal the
  // order-level math reads. Sum in cents to avoid float drift, then
  // convert back once at the boundary.
  const { sumItemSubtotalsCents } = await import("@/lib/checkout/cart-aggregate");
  const subtotalCentsSum = sumItemSubtotalsCents(resolved.map((r) => r.subtotal));
  const subtotal = subtotalCentsSum / 100;

  // ── Per-item gates (run for EACH item, mirroring the single path). ──
  // Order-minimum capability + per-category/service-area minimum is
  // applied per resolved line so a cart can't smuggle a below-minimum
  // category line through by riding on the cart's total.
  for (const r of resolved) {
    if (r.orderMinimumCapabilityActive) {
      const { enforceOrderMinimum, enforceProductMinQuantity } = await import(
        "@/lib/capabilities/order/minimum-order"
      );
      if (r.productMinimumOrderQuantity && r.billedUnitsForLineItem !== null) {
        const qtyCheck = enforceProductMinQuantity(
          r.billedUnitsForLineItem,
          r.productMinimumOrderQuantity,
        );
        if (!qtyCheck.ok) {
          await logAppEvent({
            organizationId: orgId,
            source: "checkout.website",
            action: "minimum_quantity_blocked",
            status: "warning",
            metadata: {
              productId: r.productId,
              billedUnits: r.billedUnitsForLineItem,
              minimumQuantity: r.productMinimumOrderQuantity,
            },
          });
          return fail({
            message: `${r.productName} requires a minimum of ${r.productMinimumOrderQuantity} units. Please add ${qtyCheck.shortByUnits} more to continue.`,
          });
        }
      }
      if (r.productMinimumOrderCents && r.productMinimumOrderCents > 0) {
        const lineCents = Math.round(r.subtotal * 100);
        const dollarCheck = enforceOrderMinimum(lineCents, r.productMinimumOrderCents);
        if (!dollarCheck.ok) {
          const minDollars = (r.productMinimumOrderCents / 100).toFixed(2);
          const shortDollars = (dollarCheck.shortByCents / 100).toFixed(2);
          await logAppEvent({
            organizationId: orgId,
            source: "checkout.website",
            action: "minimum_order_blocked",
            status: "warning",
            metadata: {
              subtotalCents: lineCents,
              minimumOrderCents: r.productMinimumOrderCents,
              source: "category",
            },
          });
          return fail({
            message: `${r.productName} is in a category that requires a minimum order of $${minDollars}. Please add $${shortDollars} more to continue.`,
          });
        }
      }
    }
  }

  // Service-area minimum is an ORDER-level floor (it's a per-delivery
  // economics threshold), so it's checked once against the cart total —
  // EXCEPT the single path lets a per-category minimum override it. With
  // a mixed cart there's no single category, so apply the service-area
  // minimum to the order total here.
  if (serviceArea && subtotal < serviceArea.minimumOrderAmount) {
    await logAppEvent({
      organizationId: orgId,
      source: "checkout.website",
      action: "minimum_order_blocked",
      status: "warning",
      metadata: {
        subtotal,
        effectiveMinimum: serviceArea.minimumOrderAmount,
        minimumSource: "service_area",
        serviceAreaId: serviceArea.id ?? null,
      },
    });
    return fail({
      message: `This service area requires a minimum order of $${serviceArea.minimumOrderAmount.toFixed(2)}.`,
    });
  }

  // Event date is required for a cart (every item is availability-checked).
  if (!eventDate) {
    return fail({ message: "Please select an event date to check availability." });
  }
  if (eventDate && rentalEndDate && rentalEndDate < eventDate) {
    return fail({ message: "Rental end date must be on or after the event date." });
  }

  // Booking-date policy gates (lead time / max advance). The vertical
  // lead-time floor is the STRICTEST across all items in the cart (a tent
  // in the cart raises the whole order's required notice).
  {
    const bookingPolicies = await getBookingPolicies();
    const { resolveVerticalPolicies, effectiveLeadTimeHours } = await import(
      "@/lib/verticals/policies"
    );
    let leadTimeHours = bookingPolicies.bookingLeadTimeHours;
    for (const r of resolved) {
      const verticalPolicies = resolveVerticalPolicies(r.productVerticalSlug);
      leadTimeHours = Math.max(
        leadTimeHours,
        effectiveLeadTimeHours(bookingPolicies.bookingLeadTimeHours, verticalPolicies),
      );
    }
    const eventDateMs = new Date(`${eventDate}T00:00:00Z`).getTime();
    const nowMs = Date.now();
    const leadTimeMs = leadTimeHours * 60 * 60 * 1000;
    const earliestMs = nowMs + leadTimeMs;
    const earliestDayMs = new Date(earliestMs).setUTCHours(0, 0, 0, 0);
    const maxDateMs =
      nowMs + bookingPolicies.maxAdvanceBookingDays * 24 * 60 * 60 * 1000;

    if (eventDateMs < earliestDayMs) {
      const friendly =
        leadTimeHours === 0
          ? "This event date has already passed."
          : leadTimeHours >= 48
            ? `Bookings for one or more items in your cart require at least ${Math.round(leadTimeHours / 24)} days advance notice.`
            : `Bookings require at least ${leadTimeHours} hours advance notice.`;
      return fail({ message: friendly });
    }
    if (eventDateMs > maxDateMs) {
      return fail({
        message: `Bookings cannot be more than ${bookingPolicies.maxAdvanceBookingDays} days in advance.`,
      });
    }
  }

  // ── Availability check for EVERY item up front (all-or-nothing). ──
  for (const r of resolved) {
    if (!r.productId) continue;
    const availability = await checkProductAvailability({
      organizationId: orgId,
      productId: r.productId,
      eventDate,
      startTime,
      endTime,
      rentalEndDate,
      requestedQuantity: r.billedUnitsForLineItem ?? 1,
    });
    if (!availability.available) {
      await logAppEvent({
        organizationId: orgId,
        source: "checkout.website",
        action: "availability_blocked",
        status: "warning",
        metadata: { productId: r.productId, eventDate },
      });
      return fail({
        message:
          availability.reason ??
          `${r.productName} is not available for the selected date.`,
      });
    }
  }

  // ── Customer upsert (order-level, identical to the single path). ──
  let customerId: string;
  let newCustomerId: string | null = null;

  const { data: existingCustomer } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone")
    .eq("organization_id", orgId)
    .ilike("email", email)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  if (existingCustomer) {
    customerId = existingCustomer.id;
    const customerUpdates: Record<string, unknown> = {};
    if (firstName && !existingCustomer.first_name) customerUpdates.first_name = firstName;
    if (lastName && !existingCustomer.last_name) customerUpdates.last_name = lastName;
    if (phone && !existingCustomer.phone) customerUpdates.phone = phone;
    if (smsOptIn) {
      customerUpdates.sms_opt_in = true;
      customerUpdates.sms_opt_in_at = new Date().toISOString();
      customerUpdates.sms_opt_in_ip = clientIp;
    }
    const { error: updateCustomerError } =
      Object.keys(customerUpdates).length > 0
        ? await supabase
            .from("customers")
            .update(customerUpdates)
            .eq("id", customerId)
            .eq("organization_id", orgId)
            .is("deleted_at", null)
        : { error: null };
    if (updateCustomerError) {
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to update existing customer during checkout",
        context: { customerId, reason: updateCustomerError.message },
      });
      return fail({
        message:
          "We couldn't update your contact details. Please try again or contact the operator.",
      });
    }
  } else {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .insert({
        organization_id: orgId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone ?? null,
        sms_opt_in: smsOptIn,
        sms_opt_in_at: smsOptIn ? new Date().toISOString() : null,
        sms_opt_in_ip: smsOptIn ? clientIp : null,
      })
      .select("id")
      .single();

    if (customerError?.code === "23505") {
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("organization_id", orgId)
        .ilike("email", email)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (!existing) {
        await logAppError({
          organizationId: orgId,
          source: "checkout.website",
          message: "Customer insert hit unique constraint but re-SELECT found no row",
          context: { reason: customerError.message },
        });
        return fail({ message: "We couldn't create your account. Please try again." });
      }
      customerId = existing.id;
    } else if (customerError || !customer) {
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to create customer during checkout",
        context: { reason: customerError?.message },
      });
      return fail({ message: "We couldn't create your account. Please try again." });
    } else {
      customerId = customer.id;
      newCustomerId = customer.id;
    }
  }

  let deliveryAddressId: string | null = null;
  if (fulfillmentType === "delivery") {
    const { data: address, error: addressError } = await supabase
      .from("customer_addresses")
      .insert({
        customer_id: customerId,
        organization_id: orgId,
        label: "Delivery",
        line1,
        line2: line2 || null,
        city,
        state,
        postal_code: postalCode,
        is_default_delivery: true,
      })
      .select("id")
      .single();
    if (addressError || !address) {
      if (newCustomerId) {
        await supabase.from("customers").delete().eq("id", newCustomerId).eq("organization_id", orgId);
      }
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to create address during checkout",
        context: { reason: addressError?.message, customerId },
      });
      return fail({
        message:
          "We couldn't save your delivery address. Please check the address and try again.",
      });
    }
    deliveryAddressId = address.id;
  }

  // ── STEP 3: Order-level money math (ONCE, on the summed subtotal). ──
  const deliveryFee = serviceArea?.deliveryFee ?? 0;
  const taxableBaseCents = Math.round((subtotal + deliveryFee) * 100);
  const taxResult = await computeOrderTax(supabase, {
    organizationId: orgId,
    state: fulfillmentType === "delivery" ? state ?? null : null,
    postalCode: fulfillmentType === "delivery" ? postalCode ?? null : null,
    taxableBaseCents,
  });
  const taxCents = taxResult.taxCents;
  const taxAmount = taxCents / 100;
  const totalCents = taxableBaseCents + taxCents;
  const total = totalCents / 100;

  const policies = await getBookingPolicies();
  let depositCents = Math.round(totalCents * (policies.depositPercentage / 100));
  if (policies.depositMinimum !== null) {
    const minimumCents = Math.round(policies.depositMinimum * 100);
    if (depositCents < minimumCents) depositCents = minimumCents;
  }
  let depositClampNote: string | undefined;
  if (depositCents > totalCents) {
    const configuredCents = depositCents;
    depositCents = totalCents;
    depositClampNote = `Deposit shown is your order total ($${(totalCents / 100).toFixed(2)}). The configured minimum ($${(configuredCents / 100).toFixed(2)}) exceeds the order total, so the deposit was reduced.`;
    await logAppEvent({
      organizationId: orgId,
      source: "checkout.website",
      action: "deposit_minimum_clamped",
      status: "warning",
      metadata: {
        total_cents: totalCents,
        configured_minimum: policies.depositMinimum,
        configured_percentage: policies.depositPercentage,
      },
    });
  }
  const deposit = depositCents / 100;
  const balance = (totalCents - depositCents) / 100;

  // Connect readiness (order-level, identical to the single path).
  const { canAcceptStripePayments, fieldsFromOrgRow, ORG_CONNECT_COLUMNS } =
    await import("@/lib/stripe/connect");
  const { data: connectRow } = await supabase
    .from("organizations")
    .select(`${ORG_CONNECT_COLUMNS}, default_currency`)
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  const connectReady = canAcceptStripePayments(fieldsFromOrgRow(connectRow ?? null));
  const stripeAccountId = connectRow?.stripe_connect_account_id ?? null;

  if (hasStripeEnv() && connectReady && deposit > 0) {
    const { checkFeatureAccess } = await import("@/lib/stripe/gate");
    const stripeGate = await checkFeatureAccess("stripe_payments");
    if (!stripeGate.allowed) {
      return fail({
        message:
          stripeGate.reason ?? "Online payments are not available on your current plan.",
      });
    }
  }

  const orderNumber = createOrderNumber();
  const eventStartLocal = eventDate && startTime ? `${startTime}:00` : null;
  const eventEndLocal = eventDate && endTime ? `${endTime}:00` : null;

  // ── STEP 4: Insert ONE order row. ──
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      organization_id: orgId,
      customer_id: customerId,
      order_number: orderNumber,
      order_status: policies.requireDepositToConfirm ? "awaiting_deposit" : "confirmed",
      event_date: eventDate ?? null,
      event_start_local: eventStartLocal,
      event_end_local: eventEndLocal,
      rental_end_date: rentalEndDate ?? null,
      delivery_address_id: deliveryAddressId,
      fulfillment_type: fulfillmentType,
      subtotal_amount: subtotal,
      delivery_fee_amount: deliveryFee,
      tax_amount: taxAmount,
      total_amount: total,
      deposit_due_amount: deposit,
      balance_due_amount: balance,
      source_channel: "website",
      terms_accepted_at: new Date().toISOString(),
      notes: serviceArea ? `Service area: ${serviceArea.label}` : null,
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .single();

  if (orderError?.code === "23505" && idempotencyKey) {
    const { data: raced } = await supabase
      .from("orders")
      .select("order_number")
      .eq("organization_id", orgId)
      .eq("idempotency_key", idempotencyKey)
      .is("deleted_at", null)
      .maybeSingle();
    if (raced?.order_number) {
      return {
        ok: true,
        message: "Your booking is already in. Showing your existing order.",
        orderNumber: raced.order_number,
      };
    }
  }

  if (orderError || !order) {
    if (deliveryAddressId) {
      await supabase.from("customer_addresses").delete().eq("id", deliveryAddressId).eq("customer_id", customerId);
    }
    if (newCustomerId) {
      await supabase.from("customers").delete().eq("id", newCustomerId).eq("organization_id", orgId);
    }
    await logAppError({
      organizationId: orgId,
      source: "checkout.website",
      message: "Failed to create order during checkout",
      context: { reason: orderError?.message, customerId, orderNumber },
    });
    return fail({
      message:
        "We couldn't create your booking. Please try again or contact the operator.",
    });
  }

  // Shared rollback for any per-item insert / reserve failure. Deleting
  // the order cascades order_items + the availability blocks; we also
  // remove the address and the brand-new customer (if we created one),
  // exactly like the single path's rollback.
  const rollbackOrder = async (reasonContext: Record<string, unknown>) => {
    const cleanupFailures: string[] = [];
    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", order.id)
        .eq("organization_id", orgId);
      if (error) cleanupFailures.push(`orders: ${error.message}`);
    } catch (err) {
      cleanupFailures.push(`orders: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (deliveryAddressId) {
      try {
        const { error } = await supabase
          .from("customer_addresses")
          .delete()
          .eq("id", deliveryAddressId)
          .eq("customer_id", customerId);
        if (error) cleanupFailures.push(`customer_addresses: ${error.message}`);
      } catch (err) {
        cleanupFailures.push(`customer_addresses: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    if (newCustomerId) {
      try {
        const { error } = await supabase
          .from("customers")
          .delete()
          .eq("id", newCustomerId)
          .eq("organization_id", orgId);
        if (error) cleanupFailures.push(`customers: ${error.message}`);
      } catch (err) {
        cleanupFailures.push(`customers: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    await logAppError({
      organizationId: orgId,
      source: "checkout.website",
      message:
        cleanupFailures.length > 0
          ? "Multi-item checkout failed and cleanup also failed — orphan rows possible"
          : "Multi-item checkout failed — order rolled back",
      context: { ...reasonContext, orderId: order.id, cleanupFailures: cleanupFailures.length > 0 ? cleanupFailures : undefined },
    });
  };

  // ── STEP 5: Insert per-item lines. Roll back the WHOLE order on any failure. ──
  const { insertOneItemLines } = await import("@/lib/checkout/insert-helpers");
  for (const r of resolved) {
    if (!r.productId) continue;
    const insertResult = await insertOneItemLines(supabase, {
      organizationId: orgId,
      orderId: order.id,
      productId: r.productId,
      productName: r.productName,
      subtotal: r.subtotal,
      itemRatePerDay: r.itemRatePerDay,
      itemRentalDays: r.itemRentalDays,
      billedUnitsForLineItem: r.billedUnitsForLineItem,
      billedHoursForLineItem: r.billedHoursForLineItem,
      attendantOverageHours: r.attendantOverageHours,
      effectiveMode: r.effectiveMode,
      resolvedVariantId: r.resolvedVariantId,
      resolvedAddonLines: r.resolvedAddonLines,
      waiver: r.waiver,
    });
    if (!insertResult.ok) {
      await rollbackOrder({ reason: insertResult.errorMessage, productId: r.productId, stage: "item_insert" });
      return fail({
        message: "We couldn't save your booking line items. Please try again.",
      });
    }
  }

  // ── STEP 6: Reserve availability per item. Roll back the WHOLE order on any failure. ──
  const willUseStripe = hasStripeEnv() && connectReady && deposit > 0;
  for (const r of resolved) {
    if (!r.productId) continue;
    const reserveResult = await reserveProductAvailabilityBlock({
      organizationId: orgId,
      productId: r.productId,
      orderId: order.id,
      eventDate,
      startTime,
      endTime,
      rentalEndDate,
      source: willUseStripe ? "checkout" : "dashboard",
      quantity: r.billedUnitsForLineItem ?? 1,
    });
    if (!reserveResult.ok) {
      await rollbackOrder({ reason: reserveResult.message, productId: r.productId, eventDate, stage: "reserve" });
      return fail({
        message:
          reserveResult.message ??
          `Unable to reserve availability for ${r.productName} on the selected date.`,
      });
    }
  }

  await logAppEvent({
    organizationId: orgId,
    source: "checkout.website",
    action: "order_created",
    status: "success",
    metadata: {
      orderId: order.id,
      orderNumber,
      itemCount: resolved.length,
      serviceAreaId: serviceArea?.id ?? null,
      eventDate,
    },
  });

  try {
    const { markSetupStep } = await import("@/lib/guidance/update-setup-progress");
    await markSetupStep(orgId, "has_first_order");
  } catch {
    /* non-critical */
  }

  // Build the rental line list for emails + the review summary. Only
  // `line_type='rental'` parents (each resolved item is exactly one
  // parent); add-on / waiver children are folded into the parent price.
  const fmt = (n: number) => `$${n.toFixed(2)}`;
  const summaryItems = resolved.map((r) => ({
    name: r.productName,
    quantity: r.billedUnitsForLineItem ?? 1,
    lineTotal: fmt(r.subtotal),
  }));
  const productNamesJoined = resolved.map((r) => r.productName).join(", ");

  // ── STEP 8: Confirmation email (only when no Stripe deposit). ──
  const stripeWillHandlePayment = hasStripeEnv() && connectReady && deposit > 0;
  if (!stripeWillHandlePayment) {
    try {
      const { triggerOrderConfirmationEmail } = await import("@/lib/email/triggers");
      await triggerOrderConfirmationEmail({
        organizationId: orgId,
        customerFirstName: firstName,
        customerEmail: email,
        orderNumber,
        productName: productNamesJoined,
        items: summaryItems.map((s) => ({
          name: s.name,
          quantity: s.quantity,
          lineTotal: s.lineTotal,
        })),
        eventDate: eventDate ?? "",
        subtotal,
        deliveryFee,
        total,
        depositDue: deposit,
      });
    } catch (err) {
      console.error("[checkout] confirmation email failed for", orderNumber, err instanceof Error ? err.message : err);
      const { logAppError: logErr } = await import("@/lib/observability/server");
      await logErr({
        organizationId: orgId,
        source: "checkout",
        message: "order confirmation email failed (order already committed)",
        route: "checkout",
        context: { order_number: orderNumber, recipient: email },
        error: err,
      });
    }
  }

  if (phone && smsOptIn) {
    try {
      const { sendSmsNotification } = await import("@/lib/sms/send-notification");
      const { createSupabaseServerClient: createSB } = await import("@/lib/supabase/server");
      const sb = await createSB();
      const { data: org } = await sb
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .is("deleted_at", null)
        .maybeSingle();
      await sendSmsNotification(
        "orderConfirmation",
        phone,
        { orderNumber, businessName: org?.name ?? "Your rental company" },
        orgId,
        { orderId: order.id, customerId },
      );
    } catch (smsErr) {
      console.error("[checkout] confirmation SMS failed for", orderNumber, smsErr instanceof Error ? smsErr.message : smsErr);
    }
  }

  // ── STEP 7: ONE Stripe deposit line item (integer deposit cents). ──
  if (willUseStripe && stripeAccountId) {
    try {
      const { checkFeatureAccess } = await import("@/lib/stripe/gate");
      const stripeGate = await checkFeatureAccess("stripe_payments");
      if (!stripeGate.allowed) {
        return fail({
          message:
            stripeGate.reason ?? "Online payments are not available on your current plan.",
        });
      }

      const stripe = getStripe();
      const { getRequestOrigin } = await import("@/lib/seo/metadata");
      const siteUrl = await getRequestOrigin();
      const { normalizeCurrency, toStripeMinorUnits } = await import("@/lib/money/currency");
      const orgCurrency = normalizeCurrency(connectRow?.default_currency);

      // SANITY ASSERTION (spec Risk 2): the Stripe minor-units MUST equal
      // the integer deposit-cents the order math produced. We derive the
      // charge from depositCents (integer), never by re-summing floats.
      const stripeMinorUnits = toStripeMinorUnits(deposit, orgCurrency);
      const expectedMinorUnits = toStripeMinorUnits(depositCents / 100, orgCurrency);
      if (stripeMinorUnits !== expectedMinorUnits) {
        await logAppError({
          organizationId: orgId,
          source: "checkout.website",
          message: "Stripe deposit minor-units mismatch — refusing to charge",
          context: { orderNumber, depositCents, stripeMinorUnits, expectedMinorUnits },
        });
        await rollbackOrder({ reason: "stripe_amount_mismatch", stage: "stripe_assert" });
        return fail({
          message: "We were unable to process your payment at this time. Please try again or contact us for assistance.",
        });
      }

      let customerStripeId: string | null = null;
      try {
        const { data: customerRow } = await supabase
          .from("customers")
          .select("stripe_customer_id")
          .eq("id", customerId)
          .eq("organization_id", orgId)
          .maybeSingle();
        customerStripeId = customerRow?.stripe_customer_id ?? null;
        if (!customerStripeId) {
          const created = await stripe.customers.create(
            {
              email: email ?? undefined,
              name: [firstName, lastName].filter(Boolean).join(" ") || undefined,
              phone: phone ?? undefined,
              metadata: { organization_id: orgId, customer_id: customerId },
            },
            { stripeAccount: stripeAccountId },
          );
          customerStripeId = created.id;
          await supabase
            .from("customers")
            .update({ stripe_customer_id: customerStripeId })
            .eq("id", customerId)
            .eq("organization_id", orgId)
            .is("stripe_customer_id", null);
        }
      } catch (custErr) {
        await logAppError({
          organizationId: orgId,
          source: "checkout.website.stripe_customer",
          message: "Connected-account customer create failed",
          context: { orderNumber, reason: custErr instanceof Error ? custErr.message : String(custErr) },
        });
      }

      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          line_items: [
            {
              price_data: {
                currency: orgCurrency,
                product_data: {
                  name: `Deposit — Order ${orderNumber}`,
                  description: `Deposit for ${productNamesJoined}`,
                },
                unit_amount: stripeMinorUnits,
              },
              quantity: 1,
            },
          ],
          customer_email: customerStripeId ? undefined : email,
          customer: customerStripeId ?? undefined,
          payment_intent_data: customerStripeId
            ? { setup_future_usage: "on_session" }
            : undefined,
          success_url: `${siteUrl}/order-confirmation?order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/order-confirmation?order=${orderNumber}`,
          metadata: {
            organization_id: orgId,
            order_id: order.id,
            order_number: orderNumber,
            payment_type: "deposit",
          },
        },
        { stripeAccount: stripeAccountId },
      );

      if (session.url) {
        const addrParts = [line1, city, state, postalCode].filter(Boolean);
        return {
          ok: true,
          message: `Order ${orderNumber} created!`,
          orderNumber,
          stripeUrl: session.url,
          summary: {
            productName: productNamesJoined,
            items: summaryItems,
            eventDate: eventDate ?? "",
            address: addrParts.join(", "),
            subtotal: fmt(subtotal),
            deliveryFee: fmt(deliveryFee),
            tax: taxAmount > 0 ? fmt(taxAmount) : undefined,
            taxLabel: taxResult.label ?? undefined,
            total: fmt(total),
            depositDue: fmt(deposit),
            balanceDue: fmt(balance),
            depositClampNote,
          },
        };
      }
    } catch (stripeError) {
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Stripe checkout session creation failed — cancelling order and releasing hold",
        stack: stripeError instanceof Error ? stripeError.stack : undefined,
        context: { orderNumber, deposit },
        error: stripeError,
      });
      try {
        await supabase
          .from("orders")
          .update({ order_status: "cancelled" })
          .eq("id", order.id)
          .eq("organization_id", orgId)
          .eq("order_status", "awaiting_deposit");
        await supabase
          .from("availability_blocks")
          .delete()
          .eq("source_order_id", order.id)
          .eq("organization_id", orgId)
          .eq("block_type", "checkout_hold");
      } catch {
        console.error("[checkout] Failed to cancel order/block after Stripe failure", orderNumber);
      }
      return fail({
        message:
          "We were unable to process your payment at this time. Please try again or contact us for assistance.",
      });
    }
  }

  const addrParts = [line1, city, state, postalCode].filter(Boolean);
  return {
    ok: true,
    message: `Order ${orderNumber} created successfully! A deposit of $${deposit.toFixed(2)} is required to confirm your booking.`,
    orderNumber,
    summary: {
      productName: productNamesJoined,
      items: summaryItems,
      eventDate: eventDate ?? "",
      address: addrParts.join(", "),
      subtotal: fmt(subtotal),
      deliveryFee: fmt(deliveryFee),
      tax: taxAmount > 0 ? fmt(taxAmount) : undefined,
      taxLabel: taxResult.label ?? undefined,
      total: fmt(total),
      depositDue: fmt(deposit),
      balanceDue: fmt(balance),
      depositClampNote,
    },
  };
}