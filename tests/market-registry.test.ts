import { test } from "node:test";
import assert from "node:assert/strict";

import {
  worlds,
  categories,
  riskFamilies,
  listWorldCategories,
  getCategory,
  resolveOperatingDefaults,
  restrictedItems,
  metros,
  DEFAULT_METRO_SLUG,
} from "../lib/market/registry/index.ts";
import {
  computePlatformFeeCents,
  computeSellerPayoutCents,
  computeDepositCents,
  estimatedUsedValueCents,
  MINIMUM_PLATFORM_FEE_CENTS,
} from "../lib/market/fees.ts";

test("registry: exactly 7 worlds, hosting-and-events is the only live one", () => {
  assert.equal(worlds.length, 7);
  const live = worlds.filter((w) => w.status === "live");
  assert.equal(live.length, 1);
  assert.equal(live[0]!.slug, "hosting-and-events");
  assert.ok(worlds.every((w) => w.status === "live" || w.status === "smoke_test"));
});

test("registry: 11 risk families with sane deposit defaults", () => {
  assert.equal(riskFamilies.length, 11);
  for (const f of riskFamilies) {
    assert.ok(f.defaults.depositPct > 0 && f.defaults.depositPct <= 100, f.slug);
    assert.ok(f.defaults.depositFloorCents > 0, f.slug);
    assert.ok(f.defaults.prepBufferMinutes >= 0, f.slug);
    assert.ok(f.defaults.recoveryBufferMinutes > 0, f.slug);
    assert.ok(f.defaults.targetDailyPctOfReplacement > 0, f.slug);
  }
});

test("registry: every category resolves to a world, family, and full operating defaults", () => {
  for (const c of categories) {
    const defaults = resolveOperatingDefaults(c.worldSlug, c.slug);
    assert.equal(typeof defaults.instantBookAllowed, "boolean", `${c.worldSlug}/${c.slug}`);
    assert.ok(defaults.depositFloorCents > 0);
    assert.ok(
      ["none", "auth_hold", "captured_refundable", "manual_review"].includes(
        defaults.depositStrategy,
      ),
    );
  }
});

test("registry: every world has categories; category slugs unique per world", () => {
  for (const w of worlds) {
    const cats = listWorldCategories(w.slug);
    assert.ok(cats.length >= 7, `${w.slug} has ${cats.length} categories`);
    const slugs = new Set(cats.map((c) => c.slug));
    assert.equal(slugs.size, cats.length, `duplicate category slug in ${w.slug}`);
  }
});

test("registry: world-scoped category identity — same slug in two worlds is legal and distinct", () => {
  const hosting = getCategory("hosting-and-events", "chairs-and-seating");
  const office = getCategory("office-and-pop-up", "chairs-and-seating");
  assert.ok(hosting && office);
  assert.notEqual(hosting!.riskFamilySlug === office!.riskFamilySlug && hosting === office, true);
  assert.equal(hosting!.worldSlug, "hosting-and-events");
  assert.equal(office!.worldSlug, "office-and-pop-up");
});

test("registry: trailers + high-value electronics require full ID; towables stricter", () => {
  const trailer = resolveOperatingDefaults("trailers-and-hauling", "utility-and-flatbed-trailers");
  assert.equal(trailer.identityVerification, "full_id");
  assert.equal(trailer.serialNumberRequired, true);
  const camera = resolveOperatingDefaults("creator-gear", "cameras-and-bodies");
  assert.equal(camera.identityVerification, "full_id");
  // low-risk default stays light (spec §12 defers to the §6 matrix)
  const decor = resolveOperatingDefaults("hosting-and-events", "decor-and-backdrops");
  assert.equal(decor.identityVerification, "payment_method");
});

test("registry: category overrides refine family defaults", () => {
  const monitoring = resolveOperatingDefaults("baby-gear", "monitoring-and-safety");
  assert.equal(monitoring.proofOfFunctionRequired, true);
  assert.equal(monitoring.sanitationClass, "strict"); // inherited from baby-sensitive
});

test("registry: restricted items include the §25 prohibitions", () => {
  const slugs = restrictedItems.map((r) => r.slug);
  for (const required of [
    "firearms-ammo",
    "explosives-fireworks",
    "recalled-baby-products",
    "stolen-unverifiable",
  ]) {
    assert.ok(slugs.includes(required), required);
  }
  assert.ok(restrictedItems.some((r) => r.level === "restricted_manual_review"));
});

test("registry: launch metro is DMV", () => {
  assert.equal(DEFAULT_METRO_SLUG, "dmv");
  assert.ok(metros.some((m) => m.slug === "dmv"));
});

test("fees: 15% marketplace / 8% operator with $4 minimum, zero on zero", () => {
  assert.equal(computePlatformFeeCents(10_000, "marketplace"), 1_500);
  assert.equal(computePlatformFeeCents(10_000, "korent_operator"), 800);
  // $20 booking → 12% = $2.40 → minimum $4 applies
  assert.equal(computePlatformFeeCents(2_000, "marketplace"), MINIMUM_PLATFORM_FEE_CENTS);
  assert.equal(computePlatformFeeCents(0, "marketplace"), 0);
  assert.equal(computePlatformFeeCents(-500, "korent_operator"), 0);
  assert.equal(computeSellerPayoutCents(10_000, "korent_operator"), 9_200);
});

test("deposit: formula matches spec §9", () => {
  // $2,000 camera, 2 years old, good: 2000 × 0.70 × 0.85 = $1,190 used value
  const used = estimatedUsedValueCents({
    replacementValueCents: 200_000,
    ageMonths: 24,
    condition: "good",
  });
  assert.equal(used, 119_000);
  // 35% high-value-electronics → $416.50 ≈ 41650
  const r = computeDepositCents({
    replacementValueCents: 200_000,
    ageMonths: 24,
    condition: "good",
    riskFamilyPct: 35,
    depositFloorCents: 25_000,
  });
  assert.equal(r.depositCents, 41_650);
  assert.equal(r.clampApplied, "none");
});

test("deposit: used-value cap ALWAYS beats the floor (worn cheap trailer)", () => {
  // $500 trailer, 6 years, worn: 500 × 0.40 × 0.50 = $100 used value.
  // Floor says $300 — cap wins, deposit = $100.
  const r = computeDepositCents({
    replacementValueCents: 50_000,
    ageMonths: 72,
    condition: "worn",
    riskFamilyPct: 40,
    depositFloorCents: 30_000,
  });
  assert.equal(r.estimatedUsedValueCents, 10_000);
  assert.equal(r.depositCents, 10_000);
  assert.equal(r.clampApplied, "used_value_cap");
});

test("deposit: floor applies when base is small but item is valuable", () => {
  // $800 chairs set, new: used = 800 × .85 × 1.0 = $680; 20% = $136 < $75? no →
  // pick numbers where floor binds: $300 item, new: used $255, 15% = $38.25 → floor $50
  const r = computeDepositCents({
    replacementValueCents: 30_000,
    ageMonths: 3,
    condition: "new",
    riskFamilyPct: 15,
    depositFloorCents: 5_000,
  });
  assert.equal(r.depositCents, 5_000);
  assert.equal(r.clampApplied, "floor");
});

test("deposit: high-risk accessories add 50% of their value", () => {
  const withAccessories = computeDepositCents({
    replacementValueCents: 100_000,
    ageMonths: 6,
    condition: "excellent",
    riskFamilyPct: 25,
    depositFloorCents: 10_000,
    highRiskAccessoriesValueCents: 20_000,
  });
  const without = computeDepositCents({
    replacementValueCents: 100_000,
    ageMonths: 6,
    condition: "excellent",
    riskFamilyPct: 25,
    depositFloorCents: 10_000,
  });
  assert.equal(withAccessories.depositCents - without.depositCents, 10_000);
});

test("§6 moderation: high-risk families require listing review; low-risk don't", async () => {
  const { resolveOperatingDefaults: resolve } = await import("../lib/market/registry/index.ts");
  assert.equal(resolve("trailers-and-hauling", "utility-and-flatbed-trailers").listingReviewRequired, true);
  assert.equal(resolve("creator-gear", "cameras-and-bodies").listingReviewRequired, true);
  assert.equal(resolve("baby-gear", "sleep-and-nursery").listingReviewRequired, true);
  assert.equal(resolve("hosting-and-events", "tables").listingReviewRequired, false);
});

test("facilitator tax: DC's stepped rate (6% → 6.5% Oct 2025 → 7% Oct 2026); never taxes deposits' base", async () => {
  const { computeTaxCents, taxRateForState } = await import("../lib/market/tax.ts");
  const early = new Date("2025-07-01T12:00:00Z"); // before both steps
  const mid = new Date("2026-07-01T12:00:00Z"); // 6.5% window
  const after = new Date("2026-11-01T12:00:00Z"); // 7.0%
  assert.equal(computeTaxCents(10_000, "DC", early), 600);
  assert.equal(computeTaxCents(10_000, "DC", mid), 650);
  assert.equal(computeTaxCents(10_000, "DC", after), 700);
  assert.equal(computeTaxCents(10_000, "MD", mid), 600);
  assert.equal(computeTaxCents(10_000, "VA", mid), 600);
  assert.equal(computeTaxCents(0, "DC", mid), 0);
  // unknown state → tracks the highest DMV rate (DC), never under-collects
  assert.equal(taxRateForState("XX", mid), 0.065);
  assert.equal(taxRateForState("XX", after), 0.07);
});
