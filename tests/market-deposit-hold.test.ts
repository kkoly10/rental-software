import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEPOSIT_HOLD_WINDOW_HOURS,
  decideDepositHold,
  type DepositHoldCandidate,
} from "../lib/market/deposit-hold.ts";

const HOUR = 60 * 60 * 1000;
const now = new Date("2026-06-15T12:00:00Z");

function candidate(overrides: Partial<DepositHoldCandidate> = {}): DepositHoldCandidate {
  return {
    state: "confirmed",
    depositCents: 18_000,
    depositStatus: "scheduled",
    startsAt: new Date(now.getTime() + 48 * HOUR), // inside the 96h window
    stripeCustomerId: "cus_x",
    stripePaymentMethodId: "pm_x",
    ...overrides,
  };
}

test("§9: hold placed inside handoff−96h window", () => {
  assert.deepEqual(decideDepositHold(candidate(), now), { action: "place" });
  // exactly at the window edge
  assert.deepEqual(
    decideDepositHold(
      candidate({ startsAt: new Date(now.getTime() + DEPOSIT_HOLD_WINDOW_HOURS * HOUR) }),
      now,
    ),
    { action: "place" },
  );
});

test("§9: booking far in the future waits — never authorize early", () => {
  const d = decideDepositHold(
    candidate({ startsAt: new Date(now.getTime() + 97 * HOUR) }),
    now,
  );
  assert.deepEqual(d, { action: "wait", reason: "window_not_open" });
});

test("skip: zero deposit / wrong status / wrong state", () => {
  assert.equal(decideDepositHold(candidate({ depositCents: 0 }), now).action, "skip");
  assert.equal(
    decideDepositHold(candidate({ depositStatus: "held" }), now).action,
    "skip",
  );
  assert.equal(
    decideDepositHold(candidate({ state: "checked_out" }), now).action,
    "skip",
  );
  assert.equal(
    decideDepositHold(candidate({ state: "cancelled" }), now).action,
    "skip",
  );
});

test("skip with missing_payment_method flags for manual follow-up", () => {
  const d = decideDepositHold(candidate({ stripePaymentMethodId: null }), now);
  assert.deepEqual(d, { action: "skip", reason: "missing_payment_method" });
});

test("ready_for_handoff bookings can still receive the hold", () => {
  assert.deepEqual(
    decideDepositHold(candidate({ state: "ready_for_handoff" }), now),
    { action: "place" },
  );
});
