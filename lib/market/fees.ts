/**
 * Marketplace platform fees (spec §8/§23) and the deposit engine
 * (spec §9). Pure, deterministic, cents-based — mirrors the
 * construction of lib/pricing/engine.ts.
 */

export type SellerKind = "marketplace" | "korent_operator";

// Raised from the spec's original 12% (2026-06-11): every comparable
// charges more (BabyQuip ~22%, ShareGrid 15-20%, Turo 25-40%) and 12%
// couldn't carry verification + support + dispute costs. 15% still
// undercuts the camera-gear wedge target (ShareGrid's 20%).
export const MARKETPLACE_FEE_PCT = 15;
export const OPERATOR_FEE_PCT = 8;
export const MINIMUM_PLATFORM_FEE_CENTS = 400;

/**
 * Platform fee on a booking subtotal. The refundable deposit is NEVER
 * part of the fee base (spec §23: "no fee on refundable deposit
 * holds"). Returns 0 for a zero/negative subtotal rather than
 * charging the $4 minimum on nothing.
 */
export function computePlatformFeeCents(
  subtotalCents: number,
  sellerKind: SellerKind,
): number {
  if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) return 0;
  const pct = sellerKind === "korent_operator" ? OPERATOR_FEE_PCT : MARKETPLACE_FEE_PCT;
  const raw = Math.round((Math.trunc(subtotalCents) * pct) / 100);
  return Math.max(raw, MINIMUM_PLATFORM_FEE_CENTS);
}

export function computeSellerPayoutCents(
  subtotalCents: number,
  sellerKind: SellerKind,
): number {
  if (!Number.isFinite(subtotalCents) || subtotalCents <= 0) return 0;
  return Math.trunc(subtotalCents) - computePlatformFeeCents(subtotalCents, sellerKind);
}

// ── Deposit engine (spec §9) ──────────────────────────────────────────

export type ItemCondition = "new" | "excellent" | "good" | "fair" | "worn";

const CONDITION_FACTORS: Record<ItemCondition, number> = {
  new: 1.0,
  excellent: 0.95,
  good: 0.85,
  fair: 0.7,
  worn: 0.5,
};

/** Age factors per spec §9 age bands. */
export function ageFactorForMonths(ageMonths: number): number {
  if (!Number.isFinite(ageMonths) || ageMonths < 0) return 0.85;
  if (ageMonths <= 12) return 0.85;
  if (ageMonths <= 36) return 0.7;
  if (ageMonths <= 60) return 0.55;
  return 0.4;
}

export function estimatedUsedValueCents(input: {
  replacementValueCents: number;
  ageMonths: number;
  condition: ItemCondition;
}): number {
  const replacement = Math.max(0, Math.trunc(input.replacementValueCents));
  return Math.round(
    replacement * ageFactorForMonths(input.ageMonths) * CONDITION_FACTORS[input.condition],
  );
}

export type DepositInput = {
  replacementValueCents: number;
  ageMonths: number;
  condition: ItemCondition;
  /** % of estimated used value, 0–100 (risk-family/category resolved). */
  riskFamilyPct: number;
  depositFloorCents: number;
  highRiskAccessoriesValueCents?: number;
};

export type DepositResult = {
  depositCents: number;
  estimatedUsedValueCents: number;
  /** Which clamp decided the outcome — for the deterministic explanation. */
  clampApplied: "none" | "floor" | "used_value_cap";
};

/**
 * base_deposit = (estimated_used_value × risk_family_pct)
 *              + (high_risk_accessories_value × 0.50)
 * then floor, then cap — and the used-value cap ALWAYS wins over the
 * floor (spec §9 clamp precedence: a renter must never be asked to
 * deposit more than the item is worth).
 */
export function computeDepositCents(input: DepositInput): DepositResult {
  const usedValue = estimatedUsedValueCents(input);
  const accessories = Math.max(
    0,
    Math.trunc(input.highRiskAccessoriesValueCents ?? 0),
  );
  const base = Math.round((usedValue * input.riskFamilyPct) / 100 + accessories * 0.5);

  let deposit = base;
  let clampApplied: DepositResult["clampApplied"] = "none";

  if (deposit < input.depositFloorCents) {
    deposit = input.depositFloorCents;
    clampApplied = "floor";
  }
  if (deposit > usedValue) {
    deposit = usedValue;
    clampApplied = "used_value_cap";
  }

  return { depositCents: deposit, estimatedUsedValueCents: usedValue, clampApplied };
}
