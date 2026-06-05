/**
 * `computeRentalDays` — shared math used by `lib/data/checkout-pricing.ts`
 * (storefront review summary) and `lib/checkout/actions.ts` (submit path).
 * Pre-PR-3a the two paths had independent inline math, which is exactly
 * how the "summary shows $300, charged $900" drift slipped in. These
 * tests pin the single source of truth.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computeRentalDays } from "../lib/pricing/rental-days.ts";

test("same-day rental counts as 1 day", () => {
  assert.equal(computeRentalDays("2026-07-15", "2026-07-15"), 1);
});

test("3-day span (Mon→Wed) is inclusive of both ends", () => {
  assert.equal(computeRentalDays("2026-07-13", "2026-07-15"), 3);
});

test("Mon→Fri is 5 days, not 4", () => {
  assert.equal(computeRentalDays("2026-07-13", "2026-07-17"), 5);
});

test("missing rentalEnd defaults to 1 day", () => {
  assert.equal(computeRentalDays("2026-07-15", undefined), 1);
  assert.equal(computeRentalDays("2026-07-15", null), 1);
  assert.equal(computeRentalDays("2026-07-15", ""), 1);
});

test("missing eventDate defaults to 1 day", () => {
  assert.equal(computeRentalDays(null, "2026-07-15"), 1);
  assert.equal(computeRentalDays(undefined, "2026-07-15"), 1);
});

test("reversed range clamps to 1 (matches submit path's safety guard)", () => {
  assert.equal(computeRentalDays("2026-07-20", "2026-07-15"), 1);
});

test("malformed inputs return 1 instead of throwing or returning NaN", () => {
  assert.equal(computeRentalDays("not-a-date", "2026-07-15"), 1);
  assert.equal(computeRentalDays("2026-07-15", "not-a-date"), 1);
});

test("crossing a month boundary (Jan 30 → Feb 2) returns 4 days", () => {
  assert.equal(computeRentalDays("2026-01-30", "2026-02-02"), 4);
});

test("crossing a year boundary (Dec 30 → Jan 2) returns 4 days", () => {
  assert.equal(computeRentalDays("2025-12-30", "2026-01-02"), 4);
});

test("leap-year Feb 28 → Mar 1 in 2024 is 3 days (Feb 29 + 1 + 1)", () => {
  assert.equal(computeRentalDays("2024-02-28", "2024-03-01"), 3);
});
