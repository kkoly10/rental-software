/**
 * PR-1 #3 — setup/breakdown buffer in availability window.
 *
 * Before this, getAvailabilityWindowForDate only spanned the
 * customer-facing event window. A Saturday tent with 4h setup
 * didn't block Friday evening, letting the operator double-book
 * the crew.
 *
 * These tests pin the buffer math + the no-buffer fallback so a
 * future change can't silently drop the extension.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { getAvailabilityWindowForDate } from "../lib/availability/window.ts";

test("no buffer args → original behavior preserved", () => {
  const w = getAvailabilityWindowForDate("2026-07-04", "10:00", "18:00");
  assert.equal(w?.startsAt, "2026-07-04T10:00:00.000Z");
  assert.equal(w?.endsAt, "2026-07-04T18:00:00.000Z");
});

test("setup buffer extends window backwards", () => {
  // 4h setup before a 10am event → block from 6am
  const w = getAvailabilityWindowForDate(
    "2026-07-04",
    "10:00",
    "18:00",
    null,
    240, // 4h
    0
  );
  assert.equal(w?.startsAt, "2026-07-04T06:00:00.000Z");
  assert.equal(w?.endsAt, "2026-07-04T18:00:00.000Z");
});

test("breakdown buffer extends window forwards", () => {
  // 2h breakdown after a 6pm end → block until 8pm
  const w = getAvailabilityWindowForDate(
    "2026-07-04",
    "10:00",
    "18:00",
    null,
    0,
    120
  );
  assert.equal(w?.startsAt, "2026-07-04T10:00:00.000Z");
  assert.equal(w?.endsAt, "2026-07-04T20:00:00.000Z");
});

test("setup crosses midnight → blocks previous day", () => {
  // Saturday 10am event with 16h setup → block from Friday 6pm
  const w = getAvailabilityWindowForDate(
    "2026-07-04",
    "10:00",
    "18:00",
    null,
    16 * 60,
    0
  );
  assert.equal(w?.startsAt, "2026-07-03T18:00:00.000Z");
});

test("breakdown crosses midnight → blocks next day", () => {
  // Saturday 6pm end + 8h breakdown → blocks until Sunday 2am
  const w = getAvailabilityWindowForDate(
    "2026-07-04",
    "10:00",
    "18:00",
    null,
    0,
    8 * 60
  );
  assert.equal(w?.endsAt, "2026-07-05T02:00:00.000Z");
});

test("multi-day rental gets buffer on both ends", () => {
  // Sat-Sun rental with 2h setup, 2h breakdown
  const w = getAvailabilityWindowForDate(
    "2026-07-04",
    null,
    null,
    "2026-07-05",
    120,
    120
  );
  // dayStart 2026-07-04T00:00 minus 2h = 2026-07-03T22:00
  assert.equal(w?.startsAt, "2026-07-03T22:00:00.000Z");
  // dayEnd 2026-07-06T00:00 plus 2h = 2026-07-06T02:00
  assert.equal(w?.endsAt, "2026-07-06T02:00:00.000Z");
});

test("negative buffer values clamp to 0", () => {
  const w = getAvailabilityWindowForDate(
    "2026-07-04",
    "10:00",
    "18:00",
    null,
    -60,
    -60
  );
  assert.equal(w?.startsAt, "2026-07-04T10:00:00.000Z");
  assert.equal(w?.endsAt, "2026-07-04T18:00:00.000Z");
});

test("null buffer values treated as 0", () => {
  const w = getAvailabilityWindowForDate(
    "2026-07-04",
    "10:00",
    "18:00",
    null,
    null,
    null
  );
  assert.equal(w?.startsAt, "2026-07-04T10:00:00.000Z");
  assert.equal(w?.endsAt, "2026-07-04T18:00:00.000Z");
});

test("full-day window (no times) still gets buffer", () => {
  // Whole-day Sat block with 4h setup blocks Fri 8pm onwards
  const w = getAvailabilityWindowForDate(
    "2026-07-04",
    null,
    null,
    null,
    240,
    0
  );
  assert.equal(w?.startsAt, "2026-07-03T20:00:00.000Z");
});
