/**
 * Phase 1c — setup-window capability.
 *
 * Crew arrival time = event_start − setup_minutes_before.
 * Pull-sheet rendering depends on this. A regression silently sends
 * the crew at the wrong time, so the timezone-anchored ISO contract
 * is pinned here.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { computeCrewArrivalIso } from "../lib/capabilities/setup/setup-window.ts";

test("arrival is event start minus setup minutes (60 min)", () => {
  const arrival = computeCrewArrivalIso({
    eventStartIso: "2026-07-04T18:00:00.000Z",
    setupMinutesBefore: 60,
  });
  assert.equal(arrival, "2026-07-04T17:00:00.000Z");
});

test("arrival is event start minus setup minutes (multi-hour: 2h30m = 150)", () => {
  const arrival = computeCrewArrivalIso({
    eventStartIso: "2026-07-04T18:00:00.000Z",
    setupMinutesBefore: 150,
  });
  assert.equal(arrival, "2026-07-04T15:30:00.000Z");
});

test("zero setup minutes → arrival equals event start", () => {
  const arrival = computeCrewArrivalIso({
    eventStartIso: "2026-07-04T18:00:00.000Z",
    setupMinutesBefore: 0,
  });
  assert.equal(arrival, "2026-07-04T18:00:00.000Z");
});

test("negative setup minutes clamped to 0 (defensive)", () => {
  const arrival = computeCrewArrivalIso({
    eventStartIso: "2026-07-04T18:00:00.000Z",
    setupMinutesBefore: -30,
  });
  assert.equal(arrival, "2026-07-04T18:00:00.000Z");
});

test("arrival crosses midnight backwards", () => {
  const arrival = computeCrewArrivalIso({
    eventStartIso: "2026-07-05T01:00:00.000Z",
    setupMinutesBefore: 180, // 3 hours back
  });
  assert.equal(arrival, "2026-07-04T22:00:00.000Z");
});

test("invalid eventStartIso throws (loud failure beats silent corruption)", () => {
  assert.throws(
    () =>
      computeCrewArrivalIso({
        eventStartIso: "not a date",
        setupMinutesBefore: 60,
      }),
    /invalid eventStartIso/,
  );
});

test("realistic tent scenario: arrive 3 hours before 2pm event", () => {
  const arrival = computeCrewArrivalIso({
    eventStartIso: "2026-08-15T18:00:00.000Z", // 2pm ET in DST
    setupMinutesBefore: 180,
  });
  assert.equal(arrival, "2026-08-15T15:00:00.000Z");
});
