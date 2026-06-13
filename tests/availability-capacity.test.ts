import { test } from "node:test";
import assert from "node:assert/strict";
// Relative import (not the `@/` alias): the node:test harness doesn't
// resolve tsconfig path aliases, and this module is dependency-free.
import {
  hasAvailableCapacity,
  remainingCapacity,
} from "../lib/availability/capacity.ts";

test("zero capacity is never available", () => {
  assert.equal(hasAvailableCapacity({ capacity: 0, reserved: 0 }), false);
  assert.equal(hasAvailableCapacity({ capacity: 0, reserved: 0, requested: 1 }), false);
  // Defensive: negative capacity (shouldn't happen) is unavailable too.
  assert.equal(hasAvailableCapacity({ capacity: -3, reserved: 0 }), false);
});

test("serialized single-unit: one free slot books one", () => {
  // 1 asset, nothing reserved → available for a single unit.
  assert.equal(hasAvailableCapacity({ capacity: 1, reserved: 0 }), true);
  // 1 asset already reserved → the next single booking is blocked.
  assert.equal(hasAvailableCapacity({ capacity: 1, reserved: 1 }), false);
});

test("per-unit pool: requested units must fit remaining capacity", () => {
  // 500 chairs, 350 reserved → 200 more does NOT fit (would be 550).
  assert.equal(
    hasAvailableCapacity({ capacity: 500, reserved: 350, requested: 200 }),
    false
  );
  // 150 more fits exactly (350 + 150 = 500).
  assert.equal(
    hasAvailableCapacity({ capacity: 500, reserved: 350, requested: 150 }),
    true
  );
  // 151 tips over.
  assert.equal(
    hasAvailableCapacity({ capacity: 500, reserved: 350, requested: 151 }),
    false
  );
});

test("requested quantity is clamped to at least 1 and truncated", () => {
  // 0 / negative / fractional requests all behave as a 1-unit request.
  assert.equal(hasAvailableCapacity({ capacity: 1, reserved: 0, requested: 0 }), true);
  assert.equal(hasAvailableCapacity({ capacity: 1, reserved: 0, requested: -5 }), true);
  assert.equal(hasAvailableCapacity({ capacity: 1, reserved: 1, requested: 0 }), false);
  // 2.9 truncates to 2 → needs 2 free.
  assert.equal(hasAvailableCapacity({ capacity: 2, reserved: 0, requested: 2.9 }), true);
  assert.equal(hasAvailableCapacity({ capacity: 2, reserved: 1, requested: 2.9 }), false);
});

test("remainingCapacity never goes negative", () => {
  assert.equal(remainingCapacity(10, 3), 7);
  assert.equal(remainingCapacity(10, 10), 0);
  assert.equal(remainingCapacity(10, 14), 0);
});
