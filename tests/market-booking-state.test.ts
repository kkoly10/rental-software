import { test } from "node:test";
import assert from "node:assert/strict";

import {
  BOOKING_STATES,
  TERMINAL_STATES,
  INVENTORY_BLOCKING_STATES,
  canTransition,
  assertTransition,
  blocksInventory,
  isBookingState,
  computeEffectiveWindow,
  windowsOverlap,
  type BookingState,
} from "../lib/market/booking-state.ts";

test("state machine: happy path request-to-book → completed", () => {
  const path: BookingState[] = [
    "draft",
    "pending_seller_approval",
    "confirmed",
    "ready_for_handoff",
    "checked_out",
    "returned_pending_review",
    "completed",
  ];
  for (let i = 0; i < path.length - 1; i++) {
    assert.ok(
      canTransition(path[i]!, path[i + 1]!),
      `${path[i]} → ${path[i + 1]} should be legal`,
    );
  }
});

test("state machine: auto-capture failure fallback path (§10)", () => {
  assert.ok(canTransition("pending_seller_approval", "awaiting_payment"));
  assert.ok(canTransition("awaiting_payment", "confirmed"));
  // and the normal case skips awaiting_payment entirely
  assert.ok(canTransition("pending_seller_approval", "confirmed"));
});

test("state machine: illegal jumps are rejected", () => {
  assert.equal(canTransition("draft", "completed"), false);
  assert.equal(canTransition("confirmed", "checked_out"), false); // must pass ready_for_handoff
  assert.equal(canTransition("cancelled", "confirmed"), false); // terminal
  assert.throws(() => assertTransition("draft", "completed"));
});

test("claim window: completed can re-enter disputed (and only disputed)", () => {
  assert.ok(canTransition("completed", "disputed"));
  for (const to of BOOKING_STATES) {
    if (to !== "disputed") assert.equal(canTransition("completed", to), false, to);
  }
});

test("state machine: disputes open post-checkout and resolve to completed", () => {
  assert.ok(canTransition("checked_out", "disputed"));
  assert.ok(canTransition("overdue", "disputed"));
  assert.ok(canTransition("returned_pending_review", "disputed"));
  assert.ok(canTransition("disputed", "completed"));
  assert.equal(canTransition("confirmed", "disputed"), false);
});

test("state machine: terminal states have no exits", () => {
  for (const terminal of TERMINAL_STATES) {
    for (const to of BOOKING_STATES) {
      assert.equal(canTransition(terminal, to), false, `${terminal} → ${to}`);
    }
  }
});

test("§10: pending requests do NOT block inventory; confirmed+ do", () => {
  assert.equal(blocksInventory("pending_seller_approval"), false);
  assert.equal(blocksInventory("awaiting_payment"), false);
  assert.equal(blocksInventory("draft"), false);
  for (const s of INVENTORY_BLOCKING_STATES) {
    assert.ok(blocksInventory(s));
  }
  assert.ok(INVENTORY_BLOCKING_STATES.includes("overdue"));
});

test("isBookingState guards unknown strings", () => {
  assert.ok(isBookingState("confirmed"));
  assert.equal(isBookingState("paid"), false);
});

test("§14: effective window extends by prep/recovery buffers", () => {
  const w = computeEffectiveWindow({
    startsAt: new Date("2026-06-20T09:00:00Z"),
    endsAt: new Date("2026-06-21T18:00:00Z"),
    prepBufferMinutes: 360,
    recoveryBufferMinutes: 1440,
  });
  assert.equal(w.effectiveStart.toISOString(), "2026-06-20T03:00:00.000Z");
  assert.equal(w.effectiveEnd.toISOString(), "2026-06-22T18:00:00.000Z");
});

test("§14: buffers create conflicts between back-to-back bookings", () => {
  // Booking A ends 18:00 with 24h recovery → blocks until next day 18:00.
  const a = computeEffectiveWindow({
    startsAt: new Date("2026-06-20T09:00:00Z"),
    endsAt: new Date("2026-06-20T18:00:00Z"),
    prepBufferMinutes: 0,
    recoveryBufferMinutes: 1440,
  });
  // Booking B wants the next morning — inside A's recovery window.
  const b = computeEffectiveWindow({
    startsAt: new Date("2026-06-21T09:00:00Z"),
    endsAt: new Date("2026-06-21T18:00:00Z"),
    prepBufferMinutes: 120,
    recoveryBufferMinutes: 0,
  });
  assert.ok(
    windowsOverlap(
      { start: a.effectiveStart, end: a.effectiveEnd },
      { start: b.effectiveStart, end: b.effectiveEnd },
    ),
  );
  // Two days later is clear.
  const c = computeEffectiveWindow({
    startsAt: new Date("2026-06-23T09:00:00Z"),
    endsAt: new Date("2026-06-23T18:00:00Z"),
    prepBufferMinutes: 120,
    recoveryBufferMinutes: 0,
  });
  assert.equal(
    windowsOverlap(
      { start: a.effectiveStart, end: a.effectiveEnd },
      { start: c.effectiveStart, end: c.effectiveEnd },
    ),
    false,
  );
});
