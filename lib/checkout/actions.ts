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
  // Order summary fields — populated on success so the form can show a review screen
  summary?: {
    productName: string;
    eventDate: string;
    address: string;
    subtotal: string;
    deliveryFee: string;
    total: string;
    depositDue: string;
    balanceDue: string;
  };
};

export async function createCheckoutOrder(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  const termsAccepted = formData.has("terms_accepted");
  if (!termsAccepted) {
    return {
      ok: false,
      message: "You must agree to the rental terms to place a booking.",
    };
  }

  const smsOptIn = formData.get("sms_opt_in") === "true";
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
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Please review your checkout details.",
      fieldErrors,
    };
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

      return {
        ok: false,
        message: "Too many checkout attempts. Please wait a bit and try again.",
      };
    }
  } catch (error) {
    await logAppError({
      source: "checkout.website",
      message: "Checkout rate limit check failed",
      stack: error instanceof Error ? error.stack : undefined,
      error,
    });

    return {
      ok: false,
      message: "Unable to process checkout right now. Please try again shortly.",
    };
  }

  if (!hasSupabaseEnv()) {
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
    return { ok: false, message: demoCheck.message };
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
      message: "Public checkout missing organization context",
    });

    return {
      ok: false,
      message:
        "No organization found. An operator must complete onboarding first.",
    };
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
      return { ok: false, message: "Delivery address is required for delivery orders." };
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

      return {
        ok: false,
        message:
          "We do not currently serve that delivery area. Please enter a ZIP code within a configured service area.",
      };
    }
  }

  let subtotal = 225;
  let productId: string | null = null;
  let productName = "Rental booking";
  let itemRentalDays: number | null = null;
  let itemRatePerDay: number | null = null;
  // Sprint 6.0 — captured during the product lookup so the wet
  // upcharge can be applied after the per-day pricing branch and
  // the eventual order_items insert has a value for selected_mode.
  let productSupportsModes: string[] = ["dry"];
  let productWetUpchargeCents: number | null = null;

  if (productSlug) {
    const { data: product } = await supabase
      .from("products")
      .select(
        "id, name, base_price, pricing_model, supports_modes, wet_upcharge_cents",
      )
      .eq("slug", productSlug)
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .maybeSingle();

    if (product) {
      const ratePerDay =
        typeof product.base_price === "number" ? Number(product.base_price) : 225;
      productId = product.id;
      productName = product.name ?? productSlug;
      // Sprint 6.0 — capture mode/upcharge under the same lookup so
      // the wet upcharge applies to whichever pricing branch
      // (flat_day or per_day) the product uses, and the eventual
      // order_items.selected_mode persistence has the value.
      productSupportsModes = (Array.isArray(product.supports_modes)
        ? product.supports_modes
        : ["dry"]) as string[];
      productWetUpchargeCents =
        typeof product.wet_upcharge_cents === "number"
          ? product.wet_upcharge_cents
          : null;

      const pricingModel = product.pricing_model ?? "flat_day";
      if (pricingModel === "per_day" && eventDate && rentalEndDate && rentalEndDate >= eventDate) {
        const startMs = new Date(eventDate + "T00:00:00Z").getTime();
        const endMs = new Date(rentalEndDate + "T00:00:00Z").getTime();
        // Both timestamps are UTC midnight of YYYY-MM-DD, so the
        // diff is guaranteed to be a whole multiple of one day.
        // Math.round previously masked any ms-level skew but could
        // round 0 to 0 for same-day with millisecond drift; with
        // both anchored at midnight Z, the diff is exact. +1 makes
        // both start AND end dates count (Mon→Fri = 5 days, not 4).
        const dayMs = 1000 * 60 * 60 * 24;
        const dayDiff = Math.round((endMs - startMs) / dayMs);
        const days = Math.max(1, dayDiff + 1);

        const { data: orgData } = await supabase
          .from("organizations")
          .select("settings")
          .eq("id", orgId)
          .is("deleted_at", null)
          .maybeSingle();

        const orgSettings = (orgData?.settings as Record<string, unknown>) ?? {};
        const rules: PricingRule[] = (orgSettings.pricing_rules as PricingRule[] | undefined) ?? [];

        const priceCalc = calculatePrice(ratePerDay, rules, {
          eventDate,
          bookingDate: new Date().toISOString().split("T")[0],
          rentalDays: days,
          pricingModel: "per_day",
        });

        subtotal = priceCalc.finalPrice;
        itemRentalDays = days;
        itemRatePerDay = ratePerDay;
      } else {
        subtotal = ratePerDay;
      }
    }
  }

  // Sprint 6.0 — apply the wet upcharge after the day/flat pricing
  // branch. The upcharge is a flat per-booking cleanup amortization
  // (industry pattern, not per-day), so it gets added once to
  // subtotal, never multiplied by rentalDays. Defensive: the helper
  // ignores the upcharge if the product doesn't actually support
  // wet, so a crafted ?mode=wet on a dry-only product can't bill the
  // customer extra.
  const effectiveMode: "dry" | "wet" | null =
    requestedMode && productSupportsModes.includes(requestedMode)
      ? requestedMode
      : null;
  if (effectiveMode === "wet" && (productWetUpchargeCents ?? 0) > 0) {
    subtotal += (productWetUpchargeCents ?? 0) / 100;
  }

  if (serviceArea && subtotal < serviceArea.minimumOrderAmount) {
    await logAppEvent({
      organizationId: orgId,
      source: "checkout.website",
      action: "minimum_order_blocked",
      status: "warning",
      metadata: {
        subtotal,
        minimumOrderAmount: serviceArea.minimumOrderAmount,
        serviceAreaId: serviceArea?.id ?? null,
      },
    });

    return {
      ok: false,
      message: `This service area requires a minimum order of $${serviceArea.minimumOrderAmount.toFixed(
        2
      )}.`,
    };
  }

  // Event date is required when a specific product is being booked
  if (productId && !eventDate) {
    return { ok: false, message: "Please select an event date to check availability." };
  }

  // Enforce booking date policies (lead time and max advance).
  // event_date is a YYYY-MM-DD calendar day; we compare it to the calendar
  // day that's `lead_time_hours` from now, not to "now" directly — otherwise
  // any same-day booking fails even when lead_time = 0, because midnight UTC
  // of "today" is in the past once the day has started.
  if (eventDate) {
    const bookingPolicies = await getBookingPolicies();
    const eventDateMs = new Date(`${eventDate}T00:00:00Z`).getTime();
    const nowMs = Date.now();
    const leadTimeMs = bookingPolicies.bookingLeadTimeHours * 60 * 60 * 1000;
    const earliestMs = nowMs + leadTimeMs;
    // Round earliestMs down to the start of that UTC day so a calendar-day
    // comparison vs eventDateMs (also at 00:00 UTC) is fair.
    const earliestDayMs = new Date(earliestMs).setUTCHours(0, 0, 0, 0);
    const maxDateMs = nowMs + bookingPolicies.maxAdvanceBookingDays * 24 * 60 * 60 * 1000;

    if (eventDateMs < earliestDayMs) {
      const friendly =
        bookingPolicies.bookingLeadTimeHours === 0
          ? "This event date has already passed."
          : `Bookings require at least ${bookingPolicies.bookingLeadTimeHours} hours advance notice.`;
      return { ok: false, message: friendly };
    }

    if (eventDateMs > maxDateMs) {
      return {
        ok: false,
        message: `Bookings cannot be more than ${bookingPolicies.maxAdvanceBookingDays} days in advance.`,
      };
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
        },
      });

      return {
        ok: false,
        message:
          availability.reason ??
          "This rental is not available for the selected date.",
      };
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
        context: { customerId, reason: updateCustomerError.message },
      });

      return {
        ok: false,
        message: "We couldn't update your contact details. Please try again or contact the operator.",
      };
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
          context: { reason: customerError.message },
        });
        return { ok: false, message: "We couldn't create your account. Please try again." };
      }
      customerId = existing.id;
      // Don't set newCustomerId — the other request owns the row, we
      // shouldn't rollback-delete it on later failure.
    } else if (customerError || !customer) {
      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to create customer during checkout",
        context: { reason: customerError?.message },
      });

      return {
        ok: false,
        message: "We couldn't create your account. Please try again.",
      };
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

      return {
        ok: false,
        message: "We couldn't save your delivery address. Please check the address and try again.",
      };
    }

    deliveryAddressId = address.id;
  }

  const deliveryFee = serviceArea?.deliveryFee ?? 0;

  // Compute deposit + balance in cents-integers to avoid the accumulated
  // toFixed(2) rounding drift that the previous chain — subtotal+fee
  // rounded, then *percentage rounded — could produce on multi-line
  // totals. Example: subtotal 99.99 + fee 100.00 + 30% deposit
  // previously yielded deposit 59.99 + balance 140.00 = 199.99 (≠ 200).
  // Working in cents until the final boundary keeps deposit+balance
  // equal to total to the penny.
  const totalCents = Math.round((subtotal + deliveryFee) * 100);
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
  if (depositCents > totalCents) {
    depositCents = totalCents;
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

  // Check Stripe plan gate before creating any records — fail early if org can't accept
  // online payments but a deposit is required.
  if (hasStripeEnv() && deposit > 0) {
    const { checkFeatureAccess } = await import("@/lib/stripe/gate");
    const stripeGate = await checkFeatureAccess("stripe_payments");
    if (!stripeGate.allowed) {
      return {
        ok: false,
        message: stripeGate.reason ?? "Online payments are not available on your current plan.",
      };
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
      context: { reason: orderError?.message, customerId, orderNumber },
    });

    return {
      ok: false,
      message: "We couldn't create your booking. Please try again or contact the operator.",
    };
  }

  if (productId) {
    const { error: itemError } = await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: productId,
      line_type: "rental",
      quantity: 1,
      unit_price: itemRatePerDay ?? subtotal,
      line_total: subtotal,
      item_name_snapshot: productName,
      rental_days: itemRentalDays,
      rate_per_day: itemRatePerDay,
      // Sprint 6.0 — wet/dry choice the customer made on the
      // product-detail page. NULL when the product is single-mode or
      // the customer hit a non-mode-aware path; only ever 'dry'/'wet'
      // because effectiveMode is reconciled against
      // supports_modes above.
      selected_mode: effectiveMode,
    });

    if (itemError) {
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

      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to create order item during checkout",
        context: { reason: itemError.message, orderId: order.id, productId },
      });

      return {
        ok: false,
        message: "We couldn't save your booking line items. Please try again.",
      };
    }
  }

  // Use a temporary checkout_hold only when Stripe payment is expected (webhook will convert it).
  // If Stripe isn't configured, use a permanent hold since there's no webhook to convert it.
  const willUseStripe = hasStripeEnv() && deposit > 0;

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
    });

    if (!reserveResult.ok) {
      try {
        await supabase.from("orders").delete().eq("id", order.id).eq("organization_id", orgId);
        if (deliveryAddressId) {
          await supabase.from("customer_addresses").delete().eq("id", deliveryAddressId).eq("customer_id", customerId);
        }
        if (newCustomerId) {
          await supabase.from("customers").delete().eq("id", newCustomerId).eq("organization_id", orgId);
        }
      } catch (cleanupErr) {
        console.error("[checkout] Cleanup after reserve failure failed:", cleanupErr instanceof Error ? cleanupErr.message : cleanupErr, "orderId:", order.id);
      }

      await logAppError({
        organizationId: orgId,
        source: "checkout.website",
        message: "Failed to reserve availability block during checkout",
        context: {
          reason: reserveResult.message,
          orderId: order.id,
          productId,
          eventDate,
        },
      });

      return {
        ok: false,
        message:
          reserveResult.message ??
          "Unable to reserve availability for the selected date.",
      };
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
    },
  });

  try {
    const { markSetupStep } = await import("@/lib/guidance/update-setup-progress");
    await markSetupStep(orgId, "has_first_order");
  } catch { /* non-critical */ }

  // Send order confirmation email only when no Stripe deposit is required.
  // When Stripe handles the deposit, the webhook sends a payment confirmation
  // after checkout.session.completed to avoid emailing before the customer pays.
  const stripeWillHandlePayment = hasStripeEnv() && deposit > 0;
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
        depositDue: deposit,
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

  // Attempt Stripe Checkout for deposit payment
  if (hasStripeEnv() && deposit > 0) {
    try {
      // Verify the org's plan allows Stripe payments before creating a session
      const { checkFeatureAccess } = await import("@/lib/stripe/gate");
      const stripeGate = await checkFeatureAccess("stripe_payments");
      if (!stripeGate.allowed) {
        return {
          ok: false,
          message: stripeGate.reason ?? "Online payments are not available on your current plan.",
        };
      }

      const stripe = getStripe();
      // Use the request origin so the customer is redirected back to the
      // tenant subdomain / custom domain they checked out on, not the root
      // marketing domain.
      const { getRequestOrigin } = await import("@/lib/seo/metadata");
      const siteUrl = await getRequestOrigin();

      // Resolve org currency so non-USD operators charge in their currency.
      // Falls back to "usd" if the column is null/missing. The helper
      // applies zero-decimal handling for currencies like JPY.
      const { data: orgCurrencyRow } = await supabase
        .from("organizations")
        .select("default_currency")
        .eq("id", orgId)
        .is("deleted_at", null)
        .maybeSingle();
      const { normalizeCurrency, toStripeMinorUnits } = await import("@/lib/money/currency");
      const orgCurrency = normalizeCurrency(orgCurrencyRow?.default_currency);

      const session = await stripe.checkout.sessions.create({
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
        customer_email: email,
        success_url: `${siteUrl}/order-confirmation?order=${orderNumber}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${siteUrl}/order-confirmation?order=${orderNumber}`,
        metadata: {
          organization_id: orgId,
          order_id: order.id,
          order_number: orderNumber,
          payment_type: "deposit",
        },
      });

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
            subtotal: fmt(subtotal),
            deliveryFee: fmt(deliveryFee),
            total: fmt(total),
            depositDue: fmt(deposit),
            balanceDue: fmt(balance),
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
      return {
        ok: false,
        message: "We were unable to process your payment at this time. Please try again or contact us for assistance.",
      };
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
      subtotal: fmt(subtotal),
      deliveryFee: fmt(deliveryFee),
      total: fmt(total),
      depositDue: fmt(deposit),
      balanceDue: fmt(balance),
    },
  };
}