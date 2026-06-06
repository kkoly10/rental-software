/**
 * Phase 1b — per-unit pricing capability.
 *
 * Pins the (unit_price, units) → line_total contract for tables &
 * chairs, dance-floor sections, and any future bulk-item vertical.
 *
 * Order minimums (e.g. tables/chairs operators commonly require $600)
 * are enforced by the order.minimum-order capability — not here.
 * Tests for that contract live in the minimum-order capability suite
 * when it lands in Phase 1d.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computePerUnitLineTotal } from "../lib/capabilities/pricing/per-unit.ts";

test("plain units × rate", () => {
  const result = computePerUnitLineTotal({
    unitPriceCents: 500, // $5/chair
    units: 100,
  });
  assert.equal(result.lineTotalCents, 50000); // $500
  assert.equal(result.billedUnits, 100);
});

test("zero units → zero total", () => {
  const result = computePerUnitLineTotal({
    unitPriceCents: 500,
    units: 0,
  });
  assert.equal(result.lineTotalCents, 0);
  assert.equal(result.billedUnits, 0);
});

test("single unit", () => {
  const result = computePerUnitLineTotal({
    unitPriceCents: 1500,
    units: 1,
  });
  assert.equal(result.lineTotalCents, 1500);
  assert.equal(result.billedUnits, 1);
});

test("fractional units truncated (5.7 → 5)", () => {
  // DB schema enforces integer; we'd rather under-charge than write
  // a value that would fail the CHECK constraint.
  const result = computePerUnitLineTotal({
    unitPriceCents: 1000,
    units: 5.7,
  });
  assert.equal(result.billedUnits, 5);
  assert.equal(result.lineTotalCents, 5000);
});

test("fractional units toward zero (negative truncation: -3.7 → 0)", () => {
  const result = computePerUnitLineTotal({
    unitPriceCents: 1000,
    units: -3.7,
  });
  assert.equal(result.billedUnits, 0);
  assert.equal(result.lineTotalCents, 0);
});

test("negative units clamped to 0 (never refund the customer)", () => {
  const result = computePerUnitLineTotal({
    unitPriceCents: 500,
    units: -10,
  });
  assert.equal(result.billedUnits, 0);
  assert.equal(result.lineTotalCents, 0);
});

test("negative unit price clamped to 0 (operator typo protection)", () => {
  const result = computePerUnitLineTotal({
    unitPriceCents: -500,
    units: 100,
  });
  assert.equal(result.lineTotalCents, 0);
  assert.equal(result.billedUnits, 100); // still report intent
});

test("realistic chiavari chair scenario: 200 chairs at $7", () => {
  const result = computePerUnitLineTotal({
    unitPriceCents: 700,
    units: 200,
  });
  assert.equal(result.lineTotalCents, 140000); // $1,400
});

test("realistic dance floor scenario: 16 sections at $14 per 3'×3'", () => {
  // A 12'×12' floor = 16 sections. $14/section = $224 total.
  const result = computePerUnitLineTotal({
    unitPriceCents: 1400,
    units: 16,
  });
  assert.equal(result.lineTotalCents, 22400);
  assert.equal(result.billedUnits, 16);
});

test("very large unit count (1,000 napkins)", () => {
  const result = computePerUnitLineTotal({
    unitPriceCents: 50, // $0.50/napkin
    units: 1000,
  });
  assert.equal(result.lineTotalCents, 50000); // $500
});
