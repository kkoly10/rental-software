import type { Capability } from "../types.ts";

/**
 * Per-unit pricing — used by tables & chairs, dance floors (per
 * 3'×3' section), and any future bulk-item vertical. Customer
 * picks how many units they want; line total is units × unit rate.
 *
 * Pricing rule, in plain English:
 *
 *   line_total = max(0, units) * max(0, unit_price)
 *
 * Distinct from flat-day pricing in two ways:
 *   1. The unit count is the meaningful number, not a quantity-of-
 *      items factor. A customer rents "200 chairs" as one line
 *      item, not "1 chair × 200".
 *   2. The product carries a unit_label ("chair", "section") so the
 *      storefront can display "$5 per chair × 200 = $1,000" instead
 *      of an opaque "$5 × 200".
 *
 * Defensive defaults that prevent money bugs:
 *   - Negative units clamped to 0 (never refund the customer through
 *     a sign flip)
 *   - Fractional units truncated via Math.trunc (5.7 chairs → 5; the
 *     DB schema enforces integer, and we'd rather under-charge than
 *     write a non-integer that fails the constraint)
 *   - Negative rates clamped to 0 (operator typo protection)
 *
 * Note: order.minimum-order (Phase 1d) typically pairs with this
 * capability — tables/chairs operators commonly require a $600
 * minimum. Minimum enforcement happens at the order level, not the
 * line level, so it's a separate capability and not folded here.
 */

export type PerUnitPriceInput = {
  unitPriceCents: number;
  /** Number of units. Truncated to integer; clamped to 0 minimum. */
  units: number;
};

export type PerUnitPriceResult = {
  lineTotalCents: number;
  billedUnits: number;
};

export function computePerUnitLineTotal(
  input: PerUnitPriceInput,
): PerUnitPriceResult {
  const units = Math.max(0, Math.trunc(input.units));
  const ratePerUnit = Math.max(0, input.unitPriceCents);
  return {
    lineTotalCents: units * ratePerUnit,
    billedUnits: units,
  };
}

export const perUnitPricing: Capability = {
  slug: "pricing.per-unit",
  group: "pricing",
  i18nKey: "capabilities.pricing.perUnit",
};
