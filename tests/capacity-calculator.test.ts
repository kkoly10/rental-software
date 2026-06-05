/**
 * Phase 1c — capacity-calculator capability.
 *
 * Dance-floor recommendation formula (Reventals + Imperial Party
 * Rentals 2026 guides agree):
 *   - 30–50% of guests dance
 *   - ~4 sq ft per dancer
 *   - 3'×3' section = 9 sq ft
 *
 * conservativeSections = ceil(guests × 0.3 × 4 / 9)
 * generousSections     = ceil(guests × 0.5 × 4 / 9)
 *
 * The math is industry-documented so the test table is a contract
 * with real-world operator expectations, not a freeform regression
 * suite.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { recommendDanceFloorSections } from "../lib/capabilities/display/capacity-calculator.ts";

test("100 guests → 14 sections conservative, 23 generous", () => {
  // 100 × 0.3 × 4 / 9 = 13.33 → 14
  // 100 × 0.5 × 4 / 9 = 22.22 → 23
  const r = recommendDanceFloorSections(100);
  assert.equal(r.conservativeSections, 14);
  assert.equal(r.generousSections, 23);
});

test("50 guests → 7 sections conservative, 12 generous", () => {
  // 50 × 0.3 × 4 / 9 = 6.67 → 7
  // 50 × 0.5 × 4 / 9 = 11.11 → 12
  const r = recommendDanceFloorSections(50);
  assert.equal(r.conservativeSections, 7);
  assert.equal(r.generousSections, 12);
});

test("0 guests → 0 sections", () => {
  const r = recommendDanceFloorSections(0);
  assert.equal(r.conservativeSections, 0);
  assert.equal(r.generousSections, 0);
});

test("fractional guest count truncated", () => {
  // 5.7 guests → 5 guests
  const r = recommendDanceFloorSections(5.7);
  // 5 × 0.3 × 4 / 9 = 0.67 → 1 (ceil)
  assert.equal(r.conservativeSections, 1);
  // 5 × 0.5 × 4 / 9 = 1.11 → 2 (ceil)
  assert.equal(r.generousSections, 2);
});

test("negative guests clamped to 0", () => {
  const r = recommendDanceFloorSections(-10);
  assert.equal(r.conservativeSections, 0);
  assert.equal(r.generousSections, 0);
});

test("conservative ≤ generous (invariant)", () => {
  for (const guests of [25, 75, 150, 250, 500, 1000]) {
    const r = recommendDanceFloorSections(guests);
    assert.ok(
      r.conservativeSections <= r.generousSections,
      `at ${guests} guests: conservative ${r.conservativeSections} > generous ${r.generousSections}`,
    );
  }
});

test("ceil never undersizes (realistic wedding: 200 guests)", () => {
  // 200 × 0.5 × 4 / 9 = 44.44 → 45 sections.
  // 45 × 9 = 405 sq ft = enough for 101 dancers @ 4 sq ft each.
  const r = recommendDanceFloorSections(200);
  assert.equal(r.generousSections, 45);
  assert.ok(r.generousSections * 9 >= 200 * 0.5 * 4);
});
