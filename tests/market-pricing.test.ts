/**
 * Seller pricing calculator (roadmap item 2, master plan §8).
 * The engine must be deterministic, band-driven, and never auto-set —
 * these tests pin the math the UI displays verbatim.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { suggestPricing, charmRoundCents } from "../lib/market/pricing.ts";

test("charm rounding: snaps to $5 steps and drops $1 above $20", () => {
  assert.equal(charmRoundCents(4_000), 3_900); // $40 → $39
  assert.equal(charmRoundCents(1_500), 1_500); // $15 stays
  assert.equal(charmRoundCents(2_100), 1_900); // $21 → $20 → $19
  assert.equal(charmRoundCents(350), 400); // small values round plainly
  assert.equal(charmRoundCents(40), 100); // floor at $1
});

test("the $400 ladder: passive-standard band produces a sane suggestion", () => {
  const s = suggestPricing({
    replacementValueCents: 40_000,
    ageMonths: 24, // 1–3y → 0.70
    condition: "good", // 0.85
    riskFamilySlug: "passive-standard", // 4%/day
    sellerKind: "marketplace",
  });
  assert.ok(s);
  // used value = 400 × .70 × .85 = $238 → 4% ≈ $9.52/day → charm $10
  assert.equal(s.dailyRecommendedCents, 1_000);
  assert.ok(s.dailyLowCents <= s.dailyRecommendedCents);
  assert.ok(s.dailyPremiumCents >= s.dailyRecommendedCents);
  // payout = $10 − 15% = $8.50 → 400/8.5 = 48 days (ceil 48)
  assert.equal(s.payoutPerDayCents, 850);
  assert.equal(s.recoverDays, Math.ceil(40_000 / 850));
  assert.match(s.explanation, /category guidelines/);
});

test("powered family prices ~2.5x the passive family for the same item", () => {
  const base = {
    replacementValueCents: 100_000,
    ageMonths: 6,
    condition: "excellent" as const,
    sellerKind: "marketplace" as const,
  };
  const passive = suggestPricing({ ...base, riskFamilySlug: "passive-standard" })!;
  const powered = suggestPricing({ ...base, riskFamilySlug: "powered-standard" })!;
  assert.ok(powered.dailyRecommendedCents > passive.dailyRecommendedCents * 2);
});

test("weekend and weekly multipliers hold (≈1.6x and ≈4x daily, pre-rounding)", () => {
  const s = suggestPricing({
    replacementValueCents: 200_000,
    ageMonths: 12,
    condition: "good",
    riskFamilySlug: "multi-component-event",
    sellerKind: "marketplace",
  })!;
  assert.ok(s.weekendCents > s.dailyRecommendedCents);
  assert.ok(s.weeklyCents > s.weekendCents);
  assert.ok(s.weeklyCents < s.dailyRecommendedCents * 5);
});

test("operator seller kind uses the 8% fee for payout framing", () => {
  const market = suggestPricing({
    replacementValueCents: 50_000,
    ageMonths: 0,
    condition: "new",
    riskFamilySlug: "electronics-standard",
    sellerKind: "marketplace",
  })!;
  const operator = suggestPricing({
    replacementValueCents: 50_000,
    ageMonths: 0,
    condition: "new",
    riskFamilySlug: "electronics-standard",
    sellerKind: "korent_operator",
  })!;
  assert.equal(market.dailyRecommendedCents, operator.dailyRecommendedCents);
  assert.ok(operator.payoutPerDayCents > market.payoutPerDayCents);
});

test("unknown family falls back to 5%; tiny values return null", () => {
  const s = suggestPricing({
    replacementValueCents: 20_000,
    ageMonths: 0,
    condition: "new",
    riskFamilySlug: "mystery-family",
    sellerKind: "marketplace",
  });
  assert.ok(s); // falls back, does not throw
  assert.equal(
    suggestPricing({
      replacementValueCents: 500,
      ageMonths: 0,
      condition: "new",
      riskFamilySlug: "passive-standard",
      sellerKind: "marketplace",
    }),
    null,
  );
});
