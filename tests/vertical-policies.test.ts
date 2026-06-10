/**
 * PR-2b — per-vertical cancellation + lead-time policy math.
 *
 * The portal cancel auto-refund and the checkout lead-time gate both
 * consume these helpers; the registry values are launch defaults the
 * product team signed off (tents 30d/50%, inflatable 1d/0%, etc.).
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveVerticalPolicies,
  effectiveLeadTimeHours,
  computeCancellationOutcome,
  DEFAULT_POLICIES,
} from "../lib/verticals/policies.ts";

test("every registered vertical resolves explicit policies", () => {
  const tents = resolveVerticalPolicies("tents");
  assert.equal(tents.refundWindowDays, 30);
  assert.equal(tents.forfeitPct, 50);
  assert.equal(tents.minLeadTimeHours, 21 * 24);

  const inflatable = resolveVerticalPolicies("inflatable");
  assert.equal(inflatable.refundWindowDays, 1);
  assert.equal(inflatable.forfeitPct, 0);
  assert.equal(inflatable.minLeadTimeHours, 24);
});

test("unknown / null vertical falls back to permissive defaults", () => {
  assert.deepEqual(resolveVerticalPolicies("hovercrafts"), DEFAULT_POLICIES);
  assert.deepEqual(resolveVerticalPolicies(null), DEFAULT_POLICIES);
});

test("effective lead time: org can be stricter, never looser", () => {
  const tents = resolveVerticalPolicies("tents"); // floor 504h
  assert.equal(effectiveLeadTimeHours(24, tents), 504);
  assert.equal(effectiveLeadTimeHours(600, tents), 600);
});

test("cancel outside the window → full refund", () => {
  const outcome = computeCancellationOutcome({
    depositPaid: 200,
    eventDate: "2026-08-01",
    policies: { refundWindowDays: 30, forfeitPct: 50, minLeadTimeHours: 0 },
    now: new Date("2026-06-01T12:00:00Z"), // 61 days out
  });
  assert.equal(outcome.insideWindow, false);
  assert.equal(outcome.refundAmount, 200);
  assert.equal(outcome.forfeitAmount, 0);
});

test("cancel inside the window → forfeit applies", () => {
  const outcome = computeCancellationOutcome({
    depositPaid: 200,
    eventDate: "2026-06-10",
    policies: { refundWindowDays: 30, forfeitPct: 50, minLeadTimeHours: 0 },
    now: new Date("2026-06-01T12:00:00Z"), // 8 days out
  });
  assert.equal(outcome.insideWindow, true);
  assert.equal(outcome.refundAmount, 100);
  assert.equal(outcome.forfeitAmount, 100);
});

test("inside window with forfeitPct=0 → still full refund", () => {
  const outcome = computeCancellationOutcome({
    depositPaid: 80,
    eventDate: "2026-06-02",
    policies: { refundWindowDays: 3, forfeitPct: 0, minLeadTimeHours: 0 },
    now: new Date("2026-06-01T12:00:00Z"),
  });
  assert.equal(outcome.insideWindow, true);
  assert.equal(outcome.refundAmount, 80);
  assert.equal(outcome.forfeitAmount, 0);
});

test("refund + forfeit always equals the deposit (odd cents)", () => {
  const outcome = computeCancellationOutcome({
    depositPaid: 33.33,
    eventDate: "2026-06-02",
    policies: { refundWindowDays: 7, forfeitPct: 50, minLeadTimeHours: 0 },
    now: new Date("2026-06-01T12:00:00Z"),
  });
  assert.equal(
    Math.round((outcome.refundAmount + outcome.forfeitAmount) * 100),
    3333
  );
});

test("boundary: cancelling exactly refundWindowDays out is OUTSIDE the window", () => {
  // 7 full days before a 7-day window → daysUntil = 7, 7 < 7 false.
  const outcome = computeCancellationOutcome({
    depositPaid: 100,
    eventDate: "2026-06-08",
    policies: { refundWindowDays: 7, forfeitPct: 50, minLeadTimeHours: 0 },
    now: new Date("2026-06-01T00:00:00Z"),
  });
  assert.equal(outcome.insideWindow, false);
  assert.equal(outcome.refundAmount, 100);
});

test("zero deposit → nothing to refund or forfeit", () => {
  const outcome = computeCancellationOutcome({
    depositPaid: 0,
    eventDate: "2026-06-02",
    policies: { refundWindowDays: 30, forfeitPct: 50, minLeadTimeHours: 0 },
    now: new Date("2026-06-01T12:00:00Z"),
  });
  assert.deepEqual(outcome, { insideWindow: false, refundAmount: 0, forfeitAmount: 0 });
});

test("missing event date → treated as outside window (full refund)", () => {
  const outcome = computeCancellationOutcome({
    depositPaid: 50,
    eventDate: null,
    policies: { refundWindowDays: 30, forfeitPct: 50, minLeadTimeHours: 0 },
  });
  assert.equal(outcome.insideWindow, false);
  assert.equal(outcome.refundAmount, 50);
});

test("forfeitPct above 100 clamps (refund never negative)", () => {
  const outcome = computeCancellationOutcome({
    depositPaid: 100,
    eventDate: "2026-06-02",
    policies: { refundWindowDays: 7, forfeitPct: 150, minLeadTimeHours: 0 },
    now: new Date("2026-06-01T12:00:00Z"),
  });
  assert.equal(outcome.refundAmount, 0);
  assert.equal(outcome.forfeitAmount, 100);
});

test("negative forfeitPct (operator typo) clamps to 0 — full refund inside window", () => {
  const outcome = computeCancellationOutcome({
    depositPaid: 100,
    eventDate: "2026-06-02",
    policies: { refundWindowDays: 7, forfeitPct: -25, minLeadTimeHours: 0 },
    now: new Date("2026-06-01T12:00:00Z"),
  });
  assert.equal(outcome.insideWindow, true);
  assert.equal(outcome.refundAmount, 100);
  assert.equal(outcome.forfeitAmount, 0);
});
