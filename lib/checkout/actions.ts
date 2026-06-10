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

  // No magic default. If a productSlug is provided, the pricing branch below
  // sets subtotal from the product's base_price (or rejects if unpriced —
  // decision 2.9). Generic bookings without a slug start at zero; downstream
  // payment logic will refuse a zero-total order.
  let subtotal = 0;
  let productId: string | null = null;
  let productName = "Rental booking";
  let itemRentalDays: number | null = null;
  let itemRatePerDay: number | null = null;
  // Phase 2e.7b — per-hour billing audit trail. Captured at price
  // computation, persisted to order_items.billed_hours so refunds
  // and disputes see the same number the customer was charged.
  let billedHoursForLineItem: number | null = null;
  // Phase 2e.13 — per-unit billing audit trail. Captured at price
  // computation, persisted to order_items.billed_units so refunds
  // and disputes see the same number the customer was charged.
  let billedUnitsForLineItem: number | null = null;
  // Phase 2e.14 — order-minimum enforcement at submit. Captured from
  // the product/category lookup so the post-pricing gate below can
  // reject "$5 chair order, $600 minimum" before we create the
  // order. Null when the capability isn't active.
  let productMinimumOrderCents: number | null = null;
  let productMinimumOrderQuantity: number | null = null;
  let orderMinimumCapabilityActive = false;
  // Phase 2e.15 — onsite-attendant overage at submit. Captured at
  // pricing time so the line-item insert below can write
  // attendant_overage_hours and the subtotal reflects the overage
  // charge. Null when capability inactive or no overage triggered.
  let attendantOverageHours: number | null = null;
  // Phase 2e.12 — selected variant resolved at the same lookup as the
  // product. selectedVariantId persists to order_items; the cents
  // delta is added to subtotal once the pricing branch completes.
  let resolvedVariantId: string | null = null;
  let variantPriceDeltaCents: number = 0;
  // Phase 2e.10 — resolved add-on selections + their priced totals.
  // Populated after the parent product lookup so each child line
  // item insert below can write parent_order_item_id with the right
  // product_id, quantity, line_total. Empty when capability inactive
  // or no selections sent.
  let resolvedAddonLines: Array<{
    addonProductId: string;
    name: string;
    basePriceCents: number;
    quantity: number;
    lineTotalCents: number;
  }> = [];
  // Sprint 6.0 — captured during the product lookup so the wet
  // upcharge can be applied after the per-day pricing branch and
  // the eventual order_items insert has a value for selected_mode.
  let productSupportsModes: string[] = ["dry"];
  let productWetUpchargeCents: number | null = null;
  // PR-2b — the product's vertical (via its category) drives the
  // per-vertical lead-time floor checked in the date-policy block
  // below. Null for category-less products → org policy alone.
  let productVerticalSlug: string | null = null;

  if (productSlug) {
    const { data: product } = await supabase
      .from("products")
      .select(
        "id, name, base_price, pricing_model, supports_modes, wet_upcharge_cents, capability_slugs, hourly_rate_cents, minimum_hours, unit_price_cents, minimum_order_quantity, attendant_included_hours, attendant_overage_cents_per_hour, categories(minimum_order_cents, vertical)",
      )
      .eq("slug", productSlug)
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .maybeSingle();

    if (product) {
      // PR-2b — vertical via the category embed (single or array
      // shape depending on the PostgREST relationship inference).
      const categoryJoin = (product as { categories?: unknown }).categories;
      const categoryRow = Array.isArray(categoryJoin) ? categoryJoin[0] : categoryJoin;
      productVerticalSlug =
        typeof (categoryRow as { vertical?: unknown } | null)?.vertical === "string"
          ? ((categoryRow as { vertical: string }).vertical)
          : null;

      // Phase 2e.13 — capability slugs read before the pricing
      // validity check so per-unit products (which carry their rate
      // on unit_price_cents, not base_price) aren't rejected by the
      // decision-2.9 "missing price" gate.
      const productCapabilitySlugs = Array.isArray(
        (product as { capability_slugs?: unknown }).capability_slugs,
      )
        ? ((product as { capability_slugs?: unknown }).capability_slugs as string[])
        : [];
      const productUnitPriceCents =
        typeof (product as { unit_price_cents?: unknown }).unit_price_cents === "number"
          ? ((product as { unit_price_cents?: unknown }).unit_price_cents as number)
          : null;
      const isPerUnitProduct =
        productCapabilitySlugs.includes("pricing.per-unit") &&
        productUnitPriceCents !== null &&
        productUnitPriceCents > 0;

      // Phase 2e.14 — order-minimum capability. The product carries
      // the unit-count minimum (`minimum_order_quantity`); the dollar
      // minimum lives on the category (`minimum_order_cents`) since
      // operators commonly say "tables/chairs orders < $600 aren't
      // worth our delivery time" at the category level.
      orderMinimumCapabilityActive =
        productCapabilitySlugs.includes("order.minimum-order");
      if (orderMinimumCapabilityActive) {
        productMinimumOrderQuantity =
          typeof (product as { minimum_order_quantity?: unknown }).minimum_order_quantity === "number"
            ? ((product as { minimum_order_quantity?: unknown }).minimum_order_quantity as number)
            : null;
        const category = (product as { categories?: unknown }).categories as
          | { minimum_order_cents?: number | null }
          | null;
        productMinimumOrderCents =
          typeof category?.minimum_order_cents === "number"
            ? category.minimum_order_cents
            : null;
      }

      // Decision 2.9 — refuse checkout when a product has no price set,
      // instead of silently billing the magic $225 default. Matches the
      // WooCommerce default ("empty price → no Add-to-Cart button"). The
      // product itself stays browsable on the storefront so customers can
      // still request a quote for unusual items. Per-unit products
      // satisfy the gate via unit_price_cents instead of base_price.
      const rawBasePrice = product.base_price;
      const hasValidPrice =
        (typeof rawBasePrice === "number" && rawBasePrice > 0) ||
        isPerUnitProduct;
      if (!hasValidPrice) {
        await logAppEvent({
          organizationId: orgId,
          source: "checkout.website",
          action: "missing_price_blocked",
          status: "warning",
          metadata: {
            product_slug: productSlug,
            product_id: product.id,
          }
        });
        return fail({
      message:
            "Pricing isn't set for this item yet. Please contact us to confirm a quote before booking.",
        });
      }
      const ratePerDay = Number(rawBasePrice);
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

      // Phase 2e.7b — per-hour pricing branch (photo booths,
      // concessions, mechanical bulls, future AV). When the product
      // carries pricing.per-hour AND has a configured hourly rate,
      // compute the line total from the customer's event start/end
      // times via the shared computePerHourLineTotal helper. Below
      // the minimum_hours floor still bills the minimum block, so a
      // sub-minimum rental never undercharges.
      const productHourlyRateCents =
        typeof (product as { hourly_rate_cents?: unknown }).hourly_rate_cents === "number"
          ? ((product as { hourly_rate_cents?: unknown }).hourly_rate_cents as number)
          : null;
      const productMinimumHours =
        typeof (product as { minimum_hours?: unknown }).minimum_hours === "number"
          ? ((product as { minimum_hours?: unknown }).minimum_hours as number)
          : null;
      const isPerHourProduct =
        productCapabilitySlugs.includes("pricing.per-hour") &&
        productHourlyRateCents !== null;

      const pricingModel = product.pricing_model ?? "flat_day";
      if (isPerUnitProduct) {
        // Phase 2e.13 — per-unit pricing branch (tables, chairs,
        // dance-floor sections, future bulk-item verticals). The
        // customer picks a count on the PDP; line total = units ×
        // unit_price_cents via the shared computePerUnitLineTotal
        // helper, which clamps negatives to 0 and truncates fractions
        // so a crafted `units=-5` or `units=12.7` can't undercharge
        // or write a non-integer to billed_units.
        const { computePerUnitLineTotal } = await import(
          "@/lib/capabilities/pricing/per-unit"
        );
        const perUnit = computePerUnitLineTotal({
          unitPriceCents: productUnitPriceCents ?? 0,
          units: requestedUnits,
        });
        subtotal = Number((perUnit.lineTotalCents / 100).toFixed(2));
        billedUnitsForLineItem = perUnit.billedUnits;
      } else if (isPerHourProduct) {
        const { computePerHourLineTotal } = await import(
          "@/lib/capabilities/pricing/per-hour"
        );
        // Hours from "HH:MM" start + end. Falls back to the minimum
        // (or 1) when times aren't both set — the helper's min floor
        // then rounds the rental up to a billable block.
        const computeHours = (a: string, b: string): number => {
          if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b)) return 0;
          const [ah, am] = a.split(":").map(Number);
          const [bh, bm] = b.split(":").map(Number);
          const minutes = bh * 60 + bm - (ah * 60 + am);
          return minutes > 0 ? minutes / 60 : 0;
        };
        const requestedHours = computeHours(startTime ?? "", endTime ?? "");
        const perHour = computePerHourLineTotal({
          hourlyRateCents: productHourlyRateCents ?? 0,
          quantity: 1,
          hours: requestedHours,
          minimumHours: productMinimumHours,
        });
        subtotal = Number((perHour.lineTotalCents / 100).toFixed(2));
        billedHoursForLineItem = perHour.billedHours;
      } else if (pricingModel === "per_day" && eventDate && rentalEndDate && rentalEndDate >= eventDate) {
        // Centralised in lib/pricing/rental-days.ts so the storefront
        // summary (lib/data/checkout-pricing.ts) and this submit path
        // share one source of truth for day math (#4 — three-day,
        // $300/day product was showing $300 on the summary and $900
        // on the bill).
        const { computeRentalDays } = await import("@/lib/pricing/rental-days");
        const days = computeRentalDays(eventDate, rentalEndDate);

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
          pricingModel: "per_day"
        });

        subtotal = priceCalc.finalPrice;
        itemRentalDays = days;
        itemRatePerDay = ratePerDay;
      } else {
        subtotal = ratePerDay;
      }

      // Phase 2e.15 — onsite-attendant overage. When the product
      // carries service.onsite-attendant and the customer's event
      // window exceeds attendant_included_hours, bill the overage
      // at attendant_overage_cents_per_hour. Helper clamps negatives
      // and rounds cents so an event ending before its start can't
      // crash or credit.
      if (
        productCapabilitySlugs.includes("service.onsite-attendant") &&
        startTime &&
        endTime
      ) {
        const includedHours =
          typeof (product as { attendant_included_hours?: unknown }).attendant_included_hours === "number"
            ? ((product as { attendant_included_hours?: unknown }).attendant_included_hours as number)
            : 0;
        const overageRateCents =
          typeof (product as { attendant_overage_cents_per_hour?: unknown }).attendant_overage_cents_per_hour === "number"
            ? ((product as { attendant_overage_cents_per_hour?: unknown }).attendant_overage_cents_per_hour as number)
            : null;
        const eventHours = (() => {
          if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) return 0;
          const [ah, am] = startTime.split(":").map(Number);
          const [bh, bm] = endTime.split(":").map(Number);
          const minutes = bh * 60 + bm - (ah * 60 + am);
          return minutes > 0 ? minutes / 60 : 0;
        })();
        const { computeAttendantOverage } = await import(
          "@/lib/capabilities/service/onsite-attendant"
        );
        const overage = computeAttendantOverage({
          rentalHours: eventHours,
          includedHours,
          overageRateCentsPerHour: overageRateCents,
        });
        if (overage.overageHours > 0 && overage.overageCents > 0) {
          subtotal = Number(
            (subtotal + overage.overageCents / 100).toFixed(2),
          );
          // Two decimals to match the numeric(5,2) constraint on
          // order_items.attendant_overage_hours without surprising
          // the DB with a fractional that fails to coerce.
          attendantOverageHours = Number(overage.overageHours.toFixed(2));
        }
      }

      // Phase 2e.10 — composition.add-ons dispatch. Looks up the
      // join rows scoped to the parent productId, joins the addon
      // products (name + base_price), validates customer selections
      // (max qty + product-scope) and rolls each into both subtotal
      // and the resolvedAddonLines array for the child-row insert
      // below. First cut bills each add-on as qty × addon.base_price
      // (the flat-day path); add-on per-hour billing is a follow-up.
      if (
        productCapabilitySlugs.includes("composition.add-ons") &&
        requestedAddons.length > 0
      ) {
        const { data: joinRows } = await supabase
          .from("product_addons")
          .select(
            "addon_product_id, max_quantity, addon:products!addon_product_id(id, name, base_price)",
          )
          .eq("parent_product_id", productId);
        const byAddonId = new Map<
          string,
          { name: string; basePriceCents: number; maxQuantity: number | null }
        >();
        for (const row of (joinRows ?? []) as unknown as Array<{
          addon_product_id: string;
          max_quantity: number | null;
          addon:
            | { id: string; name: string | null; base_price: number | null }
            | { id: string; name: string | null; base_price: number | null }[]
            | null;
        }>) {
          // PostgREST returns nested joins as either a single object
          // or an array depending on the FK cardinality; normalise.
          const addon = Array.isArray(row.addon) ? row.addon[0] : row.addon;
          if (!addon) continue;
          byAddonId.set(row.addon_product_id, {
            name: addon.name ?? "Add-on",
            basePriceCents:
              typeof addon.base_price === "number"
                ? Math.round(addon.base_price * 100)
                : 0,
            maxQuantity: row.max_quantity,
          });
        }
        let addonsTotalCents = 0;
        for (const sel of requestedAddons) {
          const meta = byAddonId.get(sel.addonProductId);
          if (!meta || meta.basePriceCents <= 0) continue;
          const qty =
            meta.maxQuantity != null
              ? Math.min(sel.quantity, meta.maxQuantity)
              : sel.quantity;
          if (qty <= 0) continue;
          const lineCents = qty * meta.basePriceCents;
          addonsTotalCents += lineCents;
          resolvedAddonLines.push({
            addonProductId: sel.addonProductId,
            name: meta.name,
            basePriceCents: meta.basePriceCents,
            quantity: qty,
            lineTotalCents: lineCents,
          });
        }
        if (addonsTotalCents > 0) {
          subtotal = Number(
            (subtotal + addonsTotalCents / 100).toFixed(2),
          );
        }
      }
    }
  }

  // Phase 2e.12 — variant resolution. Performed after the pricing
  // dispatch so the cents delta lands on the post-pricing subtotal
  // (a per-hour rental + variant correctly bills hours × rate + delta).
  // Scoped to the resolved productId so a crafted variant id from
  // another product / another org can't sneak through.
  if (productId && requestedVariantId) {
    // product_variants has no deleted_at column (variants are hard-
    // deleted from the form); the product_id scope is the security
    // gate that keeps a foreign variant id from being applied.
    const { data: variant } = await supabase
      .from("product_variants")
      .select("id, price_delta_cents")
      .eq("id", requestedVariantId)
      .eq("product_id", productId)
      .maybeSingle();
    if (variant && typeof variant.price_delta_cents === "number") {
      resolvedVariantId = variant.id;
      variantPriceDeltaCents = variant.price_delta_cents;
      if (variantPriceDeltaCents !== 0) {
        subtotal = Number(
          (subtotal + variantPriceDeltaCents / 100).toFixed(2),
        );
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
  // Captured here so the review-screen summary can show it as its own
  // line item rather than baking it into a higher subtotal that
  // surprises the customer. Zero when wet isn't applicable.
  const wetUpchargeApplied =
    effectiveMode === "wet" && (productWetUpchargeCents ?? 0) > 0
      ? (productWetUpchargeCents ?? 0) / 100
      : 0;
  if (wetUpchargeApplied > 0) {
    subtotal += wetUpchargeApplied;
  }

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
      }
    });

    return fail({
      message: `This service area requires a minimum order of $${serviceArea.minimumOrderAmount.toFixed(
        2
      )}.`,
    });
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
      rentalEndDate
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
    const { data: parentItem, error: itemError } = await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: productId,
      line_type: "rental",
      // Phase 2e.13 — quantity surfaces the unit count when the
      // product is priced per-unit so order summaries / pull sheets
      // show "200 chairs" instead of "1". Flat-day and per-hour
      // products still bill as a single line.
      quantity: billedUnitsForLineItem ?? 1,
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
      // Phase 2e.7b — actual hours billed for per-hour products
      // (after the minimum-floor logic). NULL for flat-day / per-day
      // products. Refund + dispute lookups read this directly.
      billed_hours: billedHoursForLineItem,
      // Phase 2e.13 — actual units billed for per-unit products
      // (after clamping / truncation). NULL for flat-day / per-hour
      // products. Refund + dispute lookups read this directly.
      billed_units: billedUnitsForLineItem,
      // Phase 2e.15 — onsite-attendant overage hours actually billed,
      // for refund / dispute lookups and post-event reconciliation.
      // NULL when capability is off or the event fits inside included
      // hours.
      attendant_overage_hours: attendantOverageHours,
      // Phase 2e.12 — variant the customer picked on the PDP. NULL
      // when no variant was selected or the id failed the
      // product-scoped lookup. The price delta has already been
      // added to subtotal / line_total above.
      selected_variant_id: resolvedVariantId,
    }).select("id").single();

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
        context: { reason: itemError.message, orderId: order.id, productId }
      });

      return fail({
      message: "We couldn't save your booking line items. Please try again.",
      });
    }

    // Phase 2e.10 — add-on child line items, linked back to the
    // parent via parent_order_item_id so refund / display can walk
    // the tree. Insert is best-effort: a failure here does NOT roll
    // back the order since the parent rental still bills correctly;
    // we log so an operator can manually reconcile.
    if (parentItem?.id && resolvedAddonLines.length > 0) {
      const childRows = resolvedAddonLines.map((line) => ({
        order_id: order.id,
        product_id: line.addonProductId,
        parent_order_item_id: parentItem.id,
        line_type: "addon",
        quantity: line.quantity,
        unit_price: line.basePriceCents / 100,
        line_total: line.lineTotalCents / 100,
        item_name_snapshot: line.name,
      }));
      const { error: addonError } = await supabase
        .from("order_items")
        .insert(childRows);
      if (addonError) {
        await logAppError({
          organizationId: orgId,
          source: "checkout.website",
          message: "Failed to insert addon line items",
          context: {
            reason: addonError.message,
            orderId: order.id,
            parentItemId: parentItem.id,
            addonCount: childRows.length,
          },
        });
      }
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
      source: willUseStripe ? "checkout" : "dashboard"
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
          customer_email: email,
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