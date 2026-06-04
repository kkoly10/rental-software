/**
 * Sprint 6.0 — wet/dry mode pricing for inflatable rentals.
 *
 * Pure function so the line-total math can be unit-tested without
 * touching Supabase or the rest of the checkout pipeline.
 *
 * Rule, in plain English:
 *
 *   line_total = (base_price + wet_upcharge_when_applicable) * quantity
 *
 * Wet upcharge is per-unit, not per-line — two wet slides at $300 +
 * $50 upcharge each pays 2 * ($300 + $50) = $700, not 2 * $300 + $50.
 * Matches industry pattern documented in
 * docs/architecture/inflatable-anchoring-and-modes.md.
 *
 * Defensive defaults so missing/inconsistent data never inflates a
 * customer's charge:
 *
 *   - product has no wet mode in supports_modes → upcharge is dropped
 *     even if selected_mode = 'wet' (shouldn't happen but the checkout
 *     UI doesn't gate against it programmatically across all paths)
 *   - selected_mode null or 'dry' → no upcharge
 *   - wet_upcharge_cents null or 0 → no upcharge (operator simply
 *     hasn't priced the wet option higher; the dry price applies)
 */

export type InflatableModePriceInput = {
  basePriceCents: number;
  quantity: number;
  supportsModes: readonly string[];
  selectedMode: string | null;
  wetUpchargeCents: number | null;
};

export function computeInflatableLineTotal(
  input: InflatableModePriceInput,
): { lineTotalCents: number; appliedWetUpcharge: boolean } {
  const upchargeApplies =
    input.selectedMode === "wet" &&
    input.supportsModes.includes("wet") &&
    (input.wetUpchargeCents ?? 0) > 0;

  const perUnitCents =
    input.basePriceCents + (upchargeApplies ? (input.wetUpchargeCents ?? 0) : 0);

  return {
    lineTotalCents: perUnitCents * Math.max(0, input.quantity),
    appliedWetUpcharge: upchargeApplies,
  };
}

/**
 * Normalize a user-supplied mode string to one of the allowed values
 * or null. Centralized so every entry point (storefront form, server
 * action, retry replay) treats unknown input the same way: ignore.
 */
export function normalizeSelectedMode(raw: unknown): "dry" | "wet" | null {
  if (raw === "dry" || raw === "wet") return raw;
  return null;
}
