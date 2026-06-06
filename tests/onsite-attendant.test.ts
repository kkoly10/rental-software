/**
 * Phase 1c — onsite-attendant capability.
 *
 * Overage rule:
 *   overage_hours = max(0, rental_hours − included_hours)
 *   overage_cents = overage_hours × overage_rate
 *
 * Used by photo booths (attendant typically included for the full
 * rental, so overage is rare) and concessions (typically 1hr
 * included, $100/hr after).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computeAttendantOverage } from "../lib/capabilities/service/onsite-attendant.ts";

test("rental within included hours → zero overage", () => {
  const r = computeAttendantOverage({
    rentalHours: 3,
    includedHours: 4,
    overageRateCentsPerHour: 10000,
  });
  assert.equal(r.overageHours, 0);
  assert.equal(r.overageCents, 0);
});

test("rental equals included hours → zero overage (no penalty)", () => {
  const r = computeAttendantOverage({
    rentalHours: 4,
    includedHours: 4,
    overageRateCentsPerHour: 10000,
  });
  assert.equal(r.overageHours, 0);
  assert.equal(r.overageCents, 0);
});

test("rental exceeds included by 2 hours → 2 × overage rate", () => {
  const r = computeAttendantOverage({
    rentalHours: 6,
    includedHours: 4,
    overageRateCentsPerHour: 10000, // $100/hr
  });
  assert.equal(r.overageHours, 2);
  assert.equal(r.overageCents, 20000); // $200
});

test("fractional overage hours preserved", () => {
  const r = computeAttendantOverage({
    rentalHours: 5.5,
    includedHours: 4,
    overageRateCentsPerHour: 8000,
  });
  assert.equal(r.overageHours, 1.5);
  assert.equal(r.overageCents, 12000); // $120
});

test("null overage rate → zero charge (operator absorbs the time)", () => {
  const r = computeAttendantOverage({
    rentalHours: 8,
    includedHours: 4,
    overageRateCentsPerHour: null,
  });
  assert.equal(r.overageHours, 4);
  assert.equal(r.overageCents, 0);
});

test("negative rental clamped to 0", () => {
  const r = computeAttendantOverage({
    rentalHours: -2,
    includedHours: 4,
    overageRateCentsPerHour: 10000,
  });
  assert.equal(r.overageHours, 0);
  assert.equal(r.overageCents, 0);
});

test("negative included clamped to 0 (defensive)", () => {
  const r = computeAttendantOverage({
    rentalHours: 3,
    includedHours: -1,
    overageRateCentsPerHour: 10000,
  });
  assert.equal(r.overageHours, 3);
  assert.equal(r.overageCents, 30000);
});

test("negative overage rate clamped to 0", () => {
  const r = computeAttendantOverage({
    rentalHours: 6,
    includedHours: 4,
    overageRateCentsPerHour: -10000,
  });
  assert.equal(r.overageHours, 2);
  assert.equal(r.overageCents, 0);
});

test("realistic concession scenario: 4-hour rental, 1hr included, $100/hr", () => {
  const r = computeAttendantOverage({
    rentalHours: 4,
    includedHours: 1,
    overageRateCentsPerHour: 10000,
  });
  assert.equal(r.overageHours, 3);
  assert.equal(r.overageCents, 30000); // $300
});
