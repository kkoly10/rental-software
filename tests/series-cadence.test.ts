/**
 * Cadence math for recurring order series (Sprint 3).
 *
 * The cadence module is the brain of the recurring-bookings feature.
 * If `nextOccurrenceDate` or `enumerateOccurrences` is wrong, every
 * downstream child order ends up on the wrong day — and the operator
 * doesn't notice until customers complain. These tests pin the rules
 * end-to-end so a future refactor can't silently rewrite the calendar.
 *
 * Special attention to:
 *   - Month-end edge cases (Jan 31 + 1 month should clamp to Feb)
 *   - Year boundaries (Dec 15 + monthly should land in Jan next year)
 *   - Leap-year February
 *   - Termination by end_date AND by max_occurrences (whichever first)
 *   - alreadyGeneratedThrough cursor — don't re-emit past dates
 *   - The batch-limit soft cap surfaces correctly
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  enumerateOccurrences,
  nextOccurrenceDate,
} from "../lib/orders/series-cadence.ts";

// ───────── nextOccurrenceDate

test("daily cadence adds N days", () => {
  assert.equal(nextOccurrenceDate("2026-06-15", { frequency: "daily", intervalCount: 1 }), "2026-06-16");
  assert.equal(nextOccurrenceDate("2026-06-15", { frequency: "daily", intervalCount: 7 }), "2026-06-22");
});

test("weekly cadence adds 7 × N days", () => {
  assert.equal(nextOccurrenceDate("2026-06-15", { frequency: "weekly", intervalCount: 1 }), "2026-06-22");
  assert.equal(nextOccurrenceDate("2026-06-15", { frequency: "weekly", intervalCount: 2 }), "2026-06-29");
});

test("biweekly cadence adds 14 × N days", () => {
  assert.equal(nextOccurrenceDate("2026-06-15", { frequency: "biweekly", intervalCount: 1 }), "2026-06-29");
});

test("monthly cadence preserves day-of-month when target month has the day", () => {
  assert.equal(nextOccurrenceDate("2026-06-15", { frequency: "monthly", intervalCount: 1 }), "2026-07-15");
});

test("monthly cadence clamps Jan 31 to Feb 28 (non-leap) or 29 (leap)", () => {
  // 2026 is not a leap year — Feb has 28 days.
  assert.equal(nextOccurrenceDate("2026-01-31", { frequency: "monthly", intervalCount: 1 }), "2026-02-28");
  // 2024 is a leap year — Feb has 29 days.
  assert.equal(nextOccurrenceDate("2024-01-31", { frequency: "monthly", intervalCount: 1 }), "2024-02-29");
});

test("monthly cadence handles year rollover", () => {
  assert.equal(nextOccurrenceDate("2026-12-15", { frequency: "monthly", intervalCount: 1 }), "2027-01-15");
  assert.equal(nextOccurrenceDate("2026-11-30", { frequency: "monthly", intervalCount: 2 }), "2027-01-30");
});

test("quarterly cadence adds 3 × N months", () => {
  assert.equal(nextOccurrenceDate("2026-01-15", { frequency: "quarterly", intervalCount: 1 }), "2026-04-15");
  assert.equal(nextOccurrenceDate("2026-01-15", { frequency: "quarterly", intervalCount: 2 }), "2026-07-15");
});

test("Jan 31 + quarterly clamps Feb-of-year-N+1 (q=4) correctly", () => {
  // 4 quarters from Jan 31 = Jan 31 next year (no clamp needed).
  assert.equal(
    nextOccurrenceDate("2026-01-31", { frequency: "quarterly", intervalCount: 4 }),
    "2027-01-31",
  );
});

// ───────── enumerateOccurrences

test("enumerate: weekly with max_occurrences=4 stops after the 4th", () => {
  const result = enumerateOccurrences({
    startDate: "2026-06-01",
    endDate: null,
    maxOccurrences: 4,
    cadence: { frequency: "weekly", intervalCount: 1 },
    alreadyGeneratedThrough: null,
    through: "2026-12-31",
  });
  assert.equal(result.reachedTerminus, true);
  assert.equal(result.occurrences.length, 4);
  assert.deepEqual(
    result.occurrences.map((o) => o.eventDate),
    ["2026-06-01", "2026-06-08", "2026-06-15", "2026-06-22"],
  );
  assert.deepEqual(
    result.occurrences.map((o) => o.occurrenceNumber),
    [1, 2, 3, 4],
  );
});

test("enumerate: end_date is inclusive and stops the series", () => {
  const result = enumerateOccurrences({
    startDate: "2026-06-01",
    endDate: "2026-06-22",
    maxOccurrences: null,
    cadence: { frequency: "weekly", intervalCount: 1 },
    alreadyGeneratedThrough: null,
    through: "2026-12-31",
  });
  assert.equal(result.reachedTerminus, true);
  assert.equal(result.occurrences.length, 4);
  assert.equal(result.occurrences[3].eventDate, "2026-06-22");
});

test("enumerate: horizon (through) is a soft stop — reachedTerminus stays false", () => {
  const result = enumerateOccurrences({
    startDate: "2026-06-01",
    endDate: null,
    maxOccurrences: null,
    cadence: { frequency: "weekly", intervalCount: 1 },
    alreadyGeneratedThrough: null,
    through: "2026-06-21",
  });
  assert.equal(result.reachedTerminus, false);
  // Should emit June 1, 8, 15 but not 22 (past through).
  assert.deepEqual(
    result.occurrences.map((o) => o.eventDate),
    ["2026-06-01", "2026-06-08", "2026-06-15"],
  );
});

test("enumerate: alreadyGeneratedThrough skips past dates but keeps numbering", () => {
  const result = enumerateOccurrences({
    startDate: "2026-06-01",
    endDate: null,
    maxOccurrences: 6,
    cadence: { frequency: "weekly", intervalCount: 1 },
    alreadyGeneratedThrough: "2026-06-15",
    through: "2026-12-31",
  });
  assert.equal(result.reachedTerminus, true);
  assert.equal(result.occurrences.length, 3); // weeks 4, 5, 6
  // Occurrence numbers stay 1-indexed against the series, not the batch.
  assert.deepEqual(
    result.occurrences.map((o) => o.occurrenceNumber),
    [4, 5, 6],
  );
  assert.equal(result.occurrences[0].eventDate, "2026-06-22");
});

test("enumerate: max_occurrences=1 (start-only) returns just the start date", () => {
  // Pathological but legitimate — a "recurring" series with one
  // occurrence is sometimes how operators model "one-time but linked".
  const result = enumerateOccurrences({
    startDate: "2026-06-01",
    endDate: null,
    maxOccurrences: 1,
    cadence: { frequency: "monthly", intervalCount: 1 },
    alreadyGeneratedThrough: null,
    through: "2026-12-31",
  });
  assert.equal(result.reachedTerminus, true);
  assert.equal(result.occurrences.length, 1);
  assert.equal(result.occurrences[0].occurrenceNumber, 1);
});

test("enumerate: batchLimit caps emissions and reports reachedTerminus=false", () => {
  // Soft cap should let the cron pick up the rest next pass.
  const result = enumerateOccurrences({
    startDate: "2026-06-01",
    endDate: null,
    maxOccurrences: 50,
    cadence: { frequency: "weekly", intervalCount: 1 },
    alreadyGeneratedThrough: null,
    through: "2027-12-31",
    batchLimit: 10,
  });
  assert.equal(result.reachedTerminus, false);
  assert.equal(result.occurrences.length, 10);
  assert.equal(result.occurrences[9].occurrenceNumber, 10);
});

test("enumerate: monthly across leap-year Feb gives clamped dates", () => {
  const result = enumerateOccurrences({
    startDate: "2024-01-31",
    endDate: null,
    maxOccurrences: 3,
    cadence: { frequency: "monthly", intervalCount: 1 },
    alreadyGeneratedThrough: null,
    through: "2024-12-31",
  });
  assert.equal(result.reachedTerminus, true);
  assert.deepEqual(
    result.occurrences.map((o) => o.eventDate),
    ["2024-01-31", "2024-02-29", "2024-03-29"],
    // Note: third occurrence is Mar 29 not Mar 31 because we shift
    // from Feb 29 (the previous occurrence), not from Jan 31. This
    // is the standard "previous occurrence drift" semantics and
    // matches what calendar apps (Google, iCal) do for monthly
    // recurring events that start on a high day.
  );
});

test("enumerate: nothing left when start is past the horizon", () => {
  const result = enumerateOccurrences({
    startDate: "2027-01-01",
    endDate: null,
    maxOccurrences: null,
    cadence: { frequency: "weekly", intervalCount: 1 },
    alreadyGeneratedThrough: null,
    through: "2026-06-30",
  });
  assert.equal(result.occurrences.length, 0);
  assert.equal(result.reachedTerminus, false);
});

test("enumerate: end_date before start_date emits nothing and terminates", () => {
  // Operator misconfiguration — surface as empty + terminal so the
  // cron doesn't keep retrying.
  const result = enumerateOccurrences({
    startDate: "2026-06-01",
    endDate: "2026-05-15",
    maxOccurrences: null,
    cadence: { frequency: "weekly", intervalCount: 1 },
    alreadyGeneratedThrough: null,
    through: "2026-12-31",
  });
  assert.equal(result.occurrences.length, 0);
  assert.equal(result.reachedTerminus, true);
});
