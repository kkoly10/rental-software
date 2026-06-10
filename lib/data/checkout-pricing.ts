import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { resolveServiceAreaForAddress } from "@/lib/service-areas/lookup";
import { getBookingPolicies } from "@/lib/data/booking-policies";
import { calculatePrice } from "@/lib/pricing/engine";
import { computeRentalDays } from "@/lib/pricing/rental-days";
import { computePerHourLineTotal } from "@/lib/capabilities/pricing/per-hour";
import { computePerUnitLineTotal } from "@/lib/capabilities/pricing/per-unit";
import { computeOrderTax } from "@/lib/checkout/tax";
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
  /** Per-jurisdiction sales/rental tax computed from the operator's
   *  tax_rules. Null while the ZIP isn't known yet; 0 when no rule
   *  matches the resolved state+postal_code (operator opts in by
   *  configuring jurisdictions). */
  tax: number | null;
  /** Label from the matched tax_rule for the receipt — null when no
   *  rule matched or pricing is still indeterminate. */
  taxLabel: string | null;
  total: number | null;
  deposit: number | null;
};

/** Parsed selections coming from the PDP query string. The page reads
 *  ?units, ?variant, ?addons from searchParams and passes them in.
 *  All optional; missing values fall back to "reference rate". */
export type CheckoutSelections = {
  units?: number;
  variantId?: string;
  /** Encoded as "uuid:qty,uuid:qty" — same shape the submit action
   *  reads from formData. We re-parse here for the review summary. */
  addons?: string;
};

export async function getCheckoutPricing(
  productSlug?: string,
  zip?: string,
  date?: string,
  selectedMode?: "dry" | "wet",
  rentalEndDate?: string,
  selections?: CheckoutSelections,
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
      tax: null,
      taxLabel: null,
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
      .select("base_price, supports_modes, wet_upcharge_cents, pricing_model, capability_slugs, hourly_rate_cents, minimum_hours, unit_price_cents")
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

  if (!product) return null;

  // Phase 2e.13 — per-unit products price from unit_price_cents, not
  // base_price; allow them past the "no base_price" early return so
  // the review summary can display the per-unit reference rate.
  const capabilitySlugs =
    ((product as { capability_slugs?: unknown }).capability_slugs as string[] | null) ?? [];
  const unitPriceCents =
    ((product as { unit_price_cents?: unknown }).unit_price_cents as number | null) ?? null;
  const isPerUnit =
    capabilitySlugs.includes("pricing.per-unit") &&
    unitPriceCents != null &&
    unitPriceCents > 0;

  if (typeof product.base_price !== "number" && !isPerUnit) return null;

  const basePrice =
    typeof product.base_price === "number" ? Number(product.base_price) : 0;
  const pricingModel = ((product as { pricing_model?: string }).pricing_model) ?? "flat_day";

  // Phase 2e.7 — per-hour pricing display. When the product carries
  // pricing.per-hour and the operator has set hourly_rate_cents, the
  // displayed subtotal is the minimum block (minimum_hours × rate),
  // matching what computePerHourLineTotal would bill for the shortest
  // valid rental. Submit-time dispatch reads the actual event start
  // and end times from the order form and bills the real hours.
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

  if (isPerUnit) {
    // Phase 1c follow-up — bill against the customer's chosen unit
    // count (from ?units=N on the URL) so the review summary matches
    // the submit-time math from #283. Falls back to 1 unit when the
    // customer hasn't picked yet so the reference rate still renders.
    const chosenUnits =
      selections?.units != null && selections.units > 0
        ? selections.units
        : 1;
    const perUnit = computePerUnitLineTotal({
      unitPriceCents: unitPriceCents ?? 0,
      units: chosenUnits,
    });
    subtotal = Number((perUnit.lineTotalCents / 100).toFixed(2));
  } else if (isPerHour) {
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

  // Phase 1c follow-up — variant price_delta. Looked up server-side
  // (same shape as the submit action's lookup in #285) so the review
  // summary matches what the customer is about to be charged. UUID
  // shape check + product-scoped lookup are the security gates.
  if (
    selections?.variantId &&
    /^[0-9a-f-]{36}$/i.test(selections.variantId)
  ) {
    const { data: variant } = await supabase
      .from("product_variants")
      .select("price_delta_cents, product_id, products!inner(slug)")
      .eq("id", selections.variantId)
      .eq("products.slug", productSlug)
      .maybeSingle();
    if (variant && typeof variant.price_delta_cents === "number" && variant.price_delta_cents !== 0) {
      subtotal = Number((subtotal + variant.price_delta_cents / 100).toFixed(2));
    }
  }

  // Phase 1c follow-up — add-ons line items reflected in the review
  // subtotal. Mirrors the submit-time dispatch from #286: parse the
  // "id:qty,id:qty" string, look up each child product's base_price
  // scoped via the parent product_addons row, sum qty × base_price.
  if (selections?.addons) {
    const parsed = selections.addons
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
    if (parsed.length > 0) {
      // Find the parent product's id by slug so we can scope the
      // product_addons lookup to its rows only.
      const { data: parentRow } = await supabase
        .from("products")
        .select("id")
        .eq("slug", productSlug)
        .eq("organization_id", orgId)
        .maybeSingle();
      if (parentRow?.id) {
        const { data: joinRows } = await supabase
          .from("product_addons")
          .select(
            "addon_product_id, max_quantity, addon:products!addon_product_id(base_price)",
          )
          .eq("parent_product_id", parentRow.id);
        const byAddonId = new Map<
          string,
          { basePriceCents: number; maxQuantity: number | null }
        >();
        for (const row of (joinRows ?? []) as unknown as Array<{
          addon_product_id: string;
          max_quantity: number | null;
          addon:
            | { base_price: number | null }
            | { base_price: number | null }[]
            | null;
        }>) {
          const addon = Array.isArray(row.addon) ? row.addon[0] : row.addon;
          if (!addon) continue;
          byAddonId.set(row.addon_product_id, {
            basePriceCents:
              typeof addon.base_price === "number"
                ? Math.round(addon.base_price * 100)
                : 0,
            maxQuantity: row.max_quantity,
          });
        }
        let addonsTotalCents = 0;
        for (const sel of parsed) {
          const meta = byAddonId.get(sel.addonProductId);
          if (!meta || meta.basePriceCents <= 0) continue;
          const qty =
            meta.maxQuantity != null
              ? Math.min(sel.quantity, meta.maxQuantity)
              : sel.quantity;
          if (qty > 0) addonsTotalCents += qty * meta.basePriceCents;
        }
        if (addonsTotalCents > 0) {
          subtotal = Number((subtotal + addonsTotalCents / 100).toFixed(2));
        }
      }
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
    return { basePrice, adjustments, subtotal, wetUpcharge, rentalDays, deliveryFee: null, tax: null, taxLabel: null, total: null, deposit: null };
  }

  const serviceArea = await resolveServiceAreaForAddress({
    organizationId: orgId,
    postalCode: zip,
  });

  if (!serviceArea) {
    return { basePrice, adjustments, subtotal, wetUpcharge, rentalDays, deliveryFee: null, tax: null, taxLabel: null, total: null, deposit: null };
  }

  const deliveryFee = serviceArea.deliveryFee;

  // Tax preview uses the service area's configured state — the
  // customer hasn't typed their full address yet on the preview
  // page, but the operator's service-area row already carries the
  // state for this ZIP, so the same per-jurisdiction lookup runs.
  const taxableBaseCents = Math.round((subtotal + deliveryFee) * 100);
  const taxResult = await computeOrderTax(supabase, {
    organizationId: orgId,
    state: serviceArea.state ?? null,
    postalCode: zip,
    taxableBaseCents,
  });
  const tax = taxResult.taxCents / 100;
  const taxLabel = taxResult.label;

  const total = Number(((taxableBaseCents + taxResult.taxCents) / 100).toFixed(2));

  const policies = await getBookingPolicies();
  let deposit = Number((total * (policies.depositPercentage / 100)).toFixed(2));
  if (policies.depositMinimum !== null && deposit < policies.depositMinimum) {
    deposit = Math.min(policies.depositMinimum, total);
  }

  return { basePrice, adjustments, subtotal, wetUpcharge, rentalDays, deliveryFee, tax, taxLabel, total, deposit };
}
