/**
 * Phase 1a — per-hour pricing capability.
 *
 * Pins the (rate, hours, minimum, quantity) → line_total contract.
 * A regression here means either (a) we silently overcharge a
 * minimum-floor customer, (b) we silently underbill a long rental,
 * or (c) we miscompute the fractional-hour rounding for a 90-minute
 * photo booth booking. All three are money bugs we'd ship a hotfix
 * for, so the table here is deliberately wide.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  computePerHourLineTotal,
  normalizeBilledHours,
} from "../lib/capabilities/pricing/per-hour.ts";

test("plain hours × rate, no minimum, quantity 1", () => {
  const result = computePerHourLineTotal({
    hourlyRateCents: 15000, // $150/hr
    quantity: 1,
    hours: 4,
    minimumHours: null,
  });
  assert.equal(result.lineTotalCents, 60000); // $600
  assert.equal(result.billedHours, 4);
  assert.equal(result.appliedMinimum, false);
});

test("hours below minimum → bill the minimum", () => {
  const result = computePerHourLineTotal({
    hourlyRateCents: 15000,
    quantity: 1,
    hours: 1,           // customer requested 1 hour
    minimumHours: 3,    // photo booth minimum is 3
  });
  assert.equal(result.billedHours, 3);
  assert.equal(result.lineTotalCents, 45000); // 3 × $150 = $450
  assert.equal(result.appliedMinimum, true);
});

test("hours at exactly minimum → no minimum applied (no extra charge)", () => {
  const result = computePerHourLineTotal({
    hourlyRateCents: 15000,
    quantity: 1,
    hours: 3,
    minimumHours: 3,
  });
  assert.equal(result.billedHours, 3);
  assert.equal(result.lineTotalCents, 45000);
  assert.equal(result.appliedMinimum, false);
});

test("hours above minimum → bill actual hours, no floor", () => {
  const result = computePerHourLineTotal({
    hourlyRateCents: 15000,
    quantity: 1,
    hours: 5,
    minimumHours: 3,
  });
  assert.equal(result.billedHours, 5);
  assert.equal(result.lineTotalCents, 75000);
  assert.equal(result.appliedMinimum, false);
});

test("quantity > 1 multiplies the line total", () => {
  const result = computePerHourLineTotal({
    hourlyRateCents: 10000, // $100/hr
    quantity: 2,            // two photo booths
    hours: 4,
    minimumHours: null,
  });
  assert.equal(result.lineTotalCents, 80000); // 4 × $100 × 2 = $800
});

test("fractional hours preserved (15-minute increments via 0.25)", () => {
  const result = computePerHourLineTotal({
    hourlyRateCents: 10000,
    quantity: 1,
    hours: 1.5,           // 90 minutes
    minimumHours: null,
  });
  assert.equal(result.billedHours, 1.5);
  assert.equal(result.lineTotalCents, 15000); // $150
});

test("rate that produces a fractional cent rounds to nearest cent", () => {
  // 0.33 hours × $100 = $33.00, exact
  // 0.333 hours × $100 = $33.30, exact
  // 0.5 hours × $99.95 = $49.975 → 4998 cents (round half to even / nearest)
  const result = computePerHourLineTotal({
    hourlyRateCents: 9995, // $99.95
    quantity: 1,
    hours: 0.5,
    minimumHours: null,
  });
  // Math.round(0.5 * 9995) = Math.round(4997.5) = 4998
  assert.equal(result.lineTotalCents, 4998);
});

test("zero hours with no minimum → zero line total", () => {
  const result = computePerHourLineTotal({
    hourlyRateCents: 15000,
    quantity: 1,
    hours: 0,
    minimumHours: null,
  });
  assert.equal(result.billedHours, 0);
  assert.equal(result.lineTotalCents, 0);
});

test("zero hours with a minimum → bill the minimum (defensive)", () => {
  // Edge case: customer submits 0 hours somehow but product has a
  // minimum. Bill the minimum rather than $0; operator can refund.
  const result = computePerHourLineTotal({
    hourlyRateCents: 15000,
    quantity: 1,
    hours: 0,
    minimumHours: 3,
  });
  assert.equal(result.billedHours, 3);
  assert.equal(result.lineTotalCents, 45000);
  assert.equal(result.appliedMinimum, true);
});

test("negative hours clamped to 0, then floored by minimum", () => {
  const result = computePerHourLineTotal({
    hourlyRateCents: 15000,
    quantity: 1,
    hours: -2,
    minimumHours: 3,
  });
  assert.equal(result.billedHours, 3);
  assert.equal(result.lineTotalCents, 45000);
});

test("negative quantity clamped to 0 (never refund by accident)", () => {
  const result = computePerHourLineTotal({
    hourlyRateCents: 15000,
    quantity: -1,
    hours: 4,
    minimumHours: null,
  });
  assert.equal(result.lineTotalCents, 0);
  assert.equal(result.billedHours, 4); // still reported as 4 — the bug is the quantity, not the hours
});

test("minimumHours of 0 behaves like no minimum", () => {
  const result = computePerHourLineTotal({
    hourlyRateCents: 15000,
    quantity: 1,
    hours: 2,
    minimumHours: 0,
  });
  assert.equal(result.billedHours, 2);
  assert.equal(result.appliedMinimum, false);
});

test("normalizeBilledHours rounds to nearest 15 minutes", () => {
  assert.equal(normalizeBilledHours(1.6), 1.5);  // 1h36min → 1h30min
  assert.equal(normalizeBilledHours(1.13), 1.25); // 1h08min → 1h15min
  assert.equal(normalizeBilledHours(3), 3);
  assert.equal(normalizeBilledHours(0), 0);
});

test("normalizeBilledHours clamps non-finite + negative to 0", () => {
  assert.equal(normalizeBilledHours(-1), 0);
  assert.equal(normalizeBilledHours(NaN), 0);
  assert.equal(normalizeBilledHours(Infinity), 0);
});

test("realistic photo-booth scenario: 4-hour booking at $200/hr, 3-hour min", () => {
  const result = computePerHourLineTotal({
    hourlyRateCents: 20000, // $200/hr
    quantity: 1,
    hours: 4,
    minimumHours: 3,
  });
  assert.equal(result.lineTotalCents, 80000); // $800
  assert.equal(result.appliedMinimum, false);
});

test("realistic concession scenario: 1-hour minimum, fractional overage", () => {
  // Customer rents popcorn machine for 90 min; vendor min is 1 hour.
  // 1.5 hours billed at the regular $50/hr = $75.
  const result = computePerHourLineTotal({
    hourlyRateCents: 5000,
    quantity: 1,
    hours: 1.5,
    minimumHours: 1,
  });
  assert.equal(result.billedHours, 1.5);
  assert.equal(result.lineTotalCents, 7500); // $75
});
