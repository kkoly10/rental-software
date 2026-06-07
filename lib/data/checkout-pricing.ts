import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { resolveServiceAreaForAddress } from "@/lib/service-areas/lookup";
import { getBookingPolicies } from "@/lib/data/booking-policies";
import { calculatePrice } from "@/lib/pricing/engine";
import { computeRentalDays } from "@/lib/pricing/rental-days";
import { computePerHourLineTotal } from "@/lib/capabilities/pricing/per-hour";
import type { PricingRule } from "@/lib/pricing/types";

export type CheckoutPricingData = {
  basePrice: number;
  adjustments: { ruleName: string; amount: number; percentage: number }[];
  subtotal: number;
  /** Sprint 6.0 — wet upcharge applied to the subtotal, surfaced so the
   *  review summary can show it as its own line item. Always 0 when the
   *  customer picked dry, the product doesn't support wet, or the
   *  operator left the upcharge blank. */
  wetUpcharge: number;
  /** Number of rental days the subtotal was computed against (per_day
   *  products only). 1 for single-day or flat_day. Surfaced so the
   *  summary can label "$300 × 3 days = $900". */
  rentalDays: number;
  deliveryFee: number | null;
  total: number | null;
  deposit: number | null;
};

export async function getCheckoutPricing(
  productSlug?: string,
  zip?: string,
  date?: string,
  selectedMode?: "dry" | "wet",
  rentalEndDate?: string,
): Promise<CheckoutPricingData | null> {
  if (!productSlug) return null;

  if (!hasSupabaseEnv()) {
    const demoSubtotal = 225;
    return {
      basePrice: demoSubtotal,
      adjustments: [],
      subtotal: demoSubtotal,
      wetUpcharge: 0,
      rentalDays: 1,
      deliveryFee: null,
      total: null,
      deposit: null,
    };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();

  const [{ data: product }, { data: org }] = await Promise.all([
    supabase
      .from("products")
      .select("base_price, supports_modes, wet_upcharge_cents, pricing_model, capability_slugs, hourly_rate_cents, minimum_hours")
      .eq("slug", productSlug)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (!product || typeof product.base_price !== "number") return null;

  const basePrice = Number(product.base_price);
  const pricingModel = ((product as { pricing_model?: string }).pricing_model) ?? "flat_day";

  // Phase 2e.7 — per-hour pricing display. When the product carries
  // pricing.per-hour and the operator has set hourly_rate_cents, the
  // displayed subtotal is the minimum block (minimum_hours × rate),
  // matching what computePerHourLineTotal would bill for the shortest
  // valid rental. Submit-time dispatch reads the actual event start
  // and end times from the order form and bills the real hours.
  const capabilitySlugs =
    ((product as { capability_slugs?: unknown }).capability_slugs as string[] | null) ?? [];
  const hourlyRateCents =
    ((product as { hourly_rate_cents?: unknown }).hourly_rate_cents as number | null) ?? null;
  const minimumHours =
    ((product as { minimum_hours?: unknown }).minimum_hours as number | null) ?? null;
  const isPerHour =
    capabilitySlugs.includes("pricing.per-hour") && hourlyRateCents != null;

  // Apply pricing rules when the customer has selected an event date.
  // Pre-#3a, this branch ignored pricing_model + rentalEndDate entirely,
  // so a per_day product's review summary showed single-day pricing
  // while the checkout submit billed days×base. Match the submit path
  // (lib/checkout/actions.ts) using the shared computeRentalDays helper.
  let subtotal = basePrice;
  let adjustments: { ruleName: string; amount: number; percentage: number }[] = [];
  let rentalDays = 1;

  if (isPerHour) {
    // Reference billing block for the review summary: bill the
    // minimum_hours (or 1 hour if unset). Submit path will recompute
    // against the actual event start/end the customer enters.
    const referenceHours = Math.max(1, minimumHours ?? 1);
    const perHour = computePerHourLineTotal({
      hourlyRateCents: hourlyRateCents ?? 0,
      quantity: 1,
      hours: referenceHours,
      minimumHours,
    });
    subtotal = Number((perHour.lineTotalCents / 100).toFixed(2));
  } else if (date) {
    const settings = (org?.settings as Record<string, unknown>) ?? {};
    const rules = (settings.pricing_rules as PricingRule[] | undefined) ?? [];
    rentalDays = computeRentalDays(date, rentalEndDate);
    if (pricingModel === "per_day") {
      const calc = calculatePrice(basePrice, rules, {
        eventDate: date,
        rentalDays,
        pricingModel: "per_day",
      });
      subtotal = calc.finalPrice;
      adjustments = calc.adjustments;
    } else if (rules.length > 0) {
      const calc = calculatePrice(basePrice, rules, { eventDate: date });
      subtotal = calc.finalPrice;
      adjustments = calc.adjustments;
    }
  }

  // Sprint 6.0 wet/dry upcharge — applied to the displayed subtotal so
  // the customer sees the same number on review that we charge at
  // submission. Mirrors the orphan-clear rule from the line-total
  // helper (lib/pricing/inflatable-mode.ts): only fires when the
  // customer picked wet AND the product genuinely supports wet AND the
  // operator priced the upcharge. Previously this was applied at
  // submission time only, so customers saw the dry price on the
  // checkout summary and discovered the higher charge after submit.
  const supportsModes = (product.supports_modes as string[] | null) ?? [];
  const wetUpchargeCents = (product.wet_upcharge_cents as number | null) ?? 0;
  const wetUpcharge =
    selectedMode === "wet" && supportsModes.includes("wet") && wetUpchargeCents > 0
      ? Number((wetUpchargeCents / 100).toFixed(2))
      : 0;
  subtotal = Number((subtotal + wetUpcharge).toFixed(2));

  if (!zip) {
    return { basePrice, adjustments, subtotal, wetUpcharge, rentalDays, deliveryFee: null, total: null, deposit: null };
  }

  const serviceArea = await resolveServiceAreaForAddress({
    organizationId: orgId,
    postalCode: zip,
  });

  if (!serviceArea) {
    return { basePrice, adjustments, subtotal, wetUpcharge, rentalDays, deliveryFee: null, total: null, deposit: null };
  }

  const deliveryFee = serviceArea.deliveryFee;
  const total = Number((subtotal + deliveryFee).toFixed(2));

  const policies = await getBookingPolicies();
  let deposit = Number((total * (policies.depositPercentage / 100)).toFixed(2));
  if (policies.depositMinimum !== null && deposit < policies.depositMinimum) {
    deposit = Math.min(policies.depositMinimum, total);
  }

  return { basePrice, adjustments, subtotal, wetUpcharge, rentalDays, deliveryFee, total, deposit };
}
