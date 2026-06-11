import {
  MARKETPLACE_FEE_PCT,
  OPERATOR_FEE_PCT,
  ageFactorForMonths,
  estimatedUsedValueCents,
  type ItemCondition,
  type SellerKind,
} from "./fees.ts";

/**
 * Seller pricing calculator (master plan §8, launch slice — roadmap
 * item 2). Deterministic and explainable: suggestions come from the
 * plan's category-family bands applied to the item's estimated used
 * value (same age/condition math as the deposit engine), framed as
 * earnings. Research guardrails (2026-06-11):
 *  - suggest with bounds, never auto-set (Airbnb race-to-the-bottom)
 *  - bands validated against ShareGrid's public 3–5%/day heuristic
 *  - weekly ≈ 3× daily, weekend ≈ 1.6× daily (industry multipliers)
 *  - charm-rounding on suggestions
 * Pre-benchmark: confidence is "category guidelines" until the §11
 * benchmark library exists.
 */

/** Daily target as a fraction of estimated used value, per risk
 *  family (master plan §8 band table). */
const FAMILY_DAILY_PCT: Record<string, number> = {
  "passive-standard": 0.04,
  "furniture-standard": 0.055,
  "powered-standard": 0.1,
  "electronics-standard": 0.065,
  "high-value-electronics": 0.04,
  "towable-road": 0.035,
  "baby-sensitive": 0.05,
  "food-contact": 0.065,
  "restoration-and-emergency": 0.12,
  "multi-component-event": 0.075,
};
const DEFAULT_DAILY_PCT = 0.05;

export type PricingSuggestion = {
  dailyLowCents: number;
  dailyRecommendedCents: number;
  dailyPremiumCents: number;
  weekendCents: number;
  weeklyCents: number;
  /** Seller payout per rental day at the recommended price. */
  payoutPerDayCents: number;
  /** Rental days at the recommended price to recover replacement value. */
  recoverDays: number;
  /** Plain-English derivation, shown verbatim in the UI. */
  explanation: string;
};

/** Charm-round a cents amount to a friendly dollar figure: snap to $5
 *  steps, then drop $1 above $20 ($40 → $39). Never below $1. */
export function charmRoundCents(cents: number): number {
  const dollars = cents / 100;
  if (dollars < 5) return Math.max(1, Math.round(dollars)) * 100;
  const snapped = Math.round(dollars / 5) * 5;
  const charmed = snapped >= 20 ? snapped - 1 : snapped;
  return charmed * 100;
}

export function suggestPricing(input: {
  replacementValueCents: number;
  ageMonths: number;
  condition: ItemCondition;
  riskFamilySlug: string;
  sellerKind: SellerKind;
}): PricingSuggestion | null {
  if (!Number.isFinite(input.replacementValueCents) || input.replacementValueCents < 1000) {
    return null; // below $10 there is nothing meaningful to suggest
  }

  const usedValue = estimatedUsedValueCents({
    replacementValueCents: Math.trunc(input.replacementValueCents),
    ageMonths: input.ageMonths,
    condition: input.condition,
  });
  const pct = FAMILY_DAILY_PCT[input.riskFamilySlug] ?? DEFAULT_DAILY_PCT;
  const rawDaily = usedValue * pct;

  const dailyRecommendedCents = charmRoundCents(rawDaily);
  const dailyLowCents = charmRoundCents(rawDaily * 0.8);
  const dailyPremiumCents = charmRoundCents(rawDaily * 1.25);
  const weekendCents = charmRoundCents(rawDaily * 1.6);
  const weeklyCents = charmRoundCents(rawDaily * 4);

  const feePct = input.sellerKind === "korent_operator" ? OPERATOR_FEE_PCT : MARKETPLACE_FEE_PCT;
  const payoutPerDayCents = Math.round(dailyRecommendedCents * (1 - feePct / 100));
  const recoverDays =
    payoutPerDayCents > 0
      ? Math.ceil(Math.trunc(input.replacementValueCents) / payoutPerDayCents)
      : 0;

  const pctLabel = (pct * 100).toFixed(1).replace(/\.0$/, "");
  const ageFactor = ageFactorForMonths(input.ageMonths);
  const explanation =
    `Similar items typically rent for about ${pctLabel}% of their current ` +
    `value per day. We estimated your item's current value at ` +
    `$${Math.round(usedValue / 100).toLocaleString("en-US")} ` +
    `(replacement value adjusted ${Math.round(ageFactor * 100)}% for age and ` +
    `condition). Based on category guidelines — local booking data will ` +
    `sharpen this over time.`;

  return {
    dailyLowCents,
    dailyRecommendedCents,
    dailyPremiumCents,
    weekendCents,
    weeklyCents,
    payoutPerDayCents,
    recoverDays,
    explanation,
  };
}
