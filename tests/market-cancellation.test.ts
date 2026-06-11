import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cancellationPresetForFamily,
  computeRenterCancellationRefund,
  computeRenterNoShowRefund,
  computeLateFeeCents,
  lateDaysStarted,
  LATE_DAYS_CAP,
} from "../lib/market/cancellation.ts";

const HOUR = 60 * 60 * 1000;
const start = new Date("2026-07-10T09:00:00Z");
const bookedLongAgo = new Date("2026-06-01T00:00:00Z");

function refundAt(hoursBefore: number, family: string, bookedAt = bookedLongAgo) {
  return computeRenterCancellationRefund({
    riskFamilySlug: family,
    startsAt: start,
    bookedAt,
    now: new Date(start.getTime() - hoursBefore * HOUR),
    chargedCents: 10_000,
  });
}

test("presets map: flexible/standard/strict by family", () => {
  assert.equal(cancellationPresetForFamily("furniture-standard").name, "flexible");
  assert.equal(cancellationPresetForFamily("powered-standard").name, "standard");
  assert.equal(cancellationPresetForFamily("towable-road").name, "strict");
  assert.equal(cancellationPresetForFamily("high-value-electronics").name, "strict");
  // unknown family falls back to standard, never to free-for-all
  assert.equal(cancellationPresetForFamily("nope").name, "standard");
});

test("flexible: 100% until 24h, 50% until handoff, 0 after", () => {
  assert.equal(refundAt(25, "furniture-standard").pct, 100);
  assert.equal(refundAt(23, "furniture-standard").pct, 50);
  assert.equal(refundAt(-1, "furniture-standard").pct, 0);
});

test("standard: 72h/24h tiers", () => {
  assert.equal(refundAt(73, "powered-standard").pct, 100);
  assert.equal(refundAt(48, "powered-standard").pct, 50);
  assert.equal(refundAt(12, "powered-standard").pct, 0);
});

test("strict: 7d/72h tiers (camera weekend protected)", () => {
  assert.equal(refundAt(8 * 24, "high-value-electronics").pct, 100);
  assert.equal(refundAt(5 * 24, "high-value-electronics").pct, 50);
  assert.equal(refundAt(48, "high-value-electronics").pct, 0);
  assert.equal(refundAt(48, "high-value-electronics").refundCents, 0);
  assert.equal(refundAt(5 * 24, "high-value-electronics").refundCents, 5_000);
});

test("universal 1h post-booking grace beats every tier", () => {
  const justBooked = new Date(start.getTime() - 10 * HOUR);
  const r = computeRenterCancellationRefund({
    riskFamilySlug: "towable-road",
    startsAt: start,
    bookedAt: justBooked,
    now: new Date(justBooked.getTime() + 30 * 60 * 1000),
    chargedCents: 10_000,
  });
  assert.equal(r.pct, 100);
});

test("renter no-show: seller keeps 1 day multi-day, 75% single-day", () => {
  const multi = computeRenterNoShowRefund({
    dailyPriceCents: 10_000,
    quantity: 1,
    rentalDays: 3,
    chargedCents: 31_800, // 3 days + tax
  });
  assert.equal(multi.sellerKeepsCents, 10_000);
  assert.equal(multi.refundCents, 21_800);

  const single = computeRenterNoShowRefund({
    dailyPriceCents: 10_000,
    quantity: 1,
    rentalDays: 1,
    chargedCents: 10_600,
  });
  assert.equal(single.sellerKeepsCents, 7_500);
  assert.equal(single.refundCents, 3_100);
});

test("late fees: 2h grace, 1x daily + $20 per started day, 3-day cap", () => {
  const end = new Date("2026-07-12T18:00:00Z");
  assert.equal(lateDaysStarted(end, new Date(end.getTime() + 1 * HOUR)), 0); // grace
  assert.equal(lateDaysStarted(end, new Date(end.getTime() + 3 * HOUR)), 1);
  assert.equal(lateDaysStarted(end, new Date(end.getTime() + 30 * HOUR)), 2);
  assert.equal(lateDaysStarted(end, new Date(end.getTime() + 300 * HOUR)), LATE_DAYS_CAP);

  assert.equal(computeLateFeeCents({ dailyPriceCents: 8_000, quantity: 1, lateDays: 1 }), 10_000);
  assert.equal(computeLateFeeCents({ dailyPriceCents: 8_000, quantity: 2, lateDays: 2 }), 36_000);
  assert.equal(
    computeLateFeeCents({ dailyPriceCents: 8_000, quantity: 1, lateDays: 99 }),
    3 * 10_000,
  );
});
