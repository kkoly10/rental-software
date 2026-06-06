/**
 * Phase 1c — order.minimum-order capability.
 *
 * Two flavors:
 *   - enforceOrderMinimum:        order total ≥ category $ floor
 *   - enforceProductMinQuantity:  per-product unit floor
 *
 * Both return { ok, shortBy* } so the storefront can render a
 * friendly "add $X more" / "minimum N units" message rather than
 * a hard error.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  enforceOrderMinimum,
  enforceProductMinQuantity,
} from "../lib/capabilities/order/minimum-order.ts";

// ─── enforceOrderMinimum ────────────────────────────────────────

test("order at minimum → ok, shortBy 0", () => {
  const r = enforceOrderMinimum(60000, 60000);
  assert.deepEqual(r, { ok: true, shortByCents: 0 });
});

test("order above minimum → ok", () => {
  const r = enforceOrderMinimum(75000, 60000);
  assert.deepEqual(r, { ok: true, shortByCents: 0 });
});

test("order below minimum → not ok, reports shortfall", () => {
  const r = enforceOrderMinimum(45000, 60000);
  assert.deepEqual(r, { ok: false, shortByCents: 15000 });
});

test("null minimum → always ok (no minimum configured)", () => {
  const r = enforceOrderMinimum(100, null);
  assert.deepEqual(r, { ok: true, shortByCents: 0 });
});

test("zero minimum → always ok", () => {
  const r = enforceOrderMinimum(0, 0);
  assert.deepEqual(r, { ok: true, shortByCents: 0 });
});

test("negative total clamped to 0, then evaluated against minimum", () => {
  const r = enforceOrderMinimum(-100, 50000);
  assert.deepEqual(r, { ok: false, shortByCents: 50000 });
});

test("realistic tables/chairs $600 minimum, customer has $450 cart", () => {
  const r = enforceOrderMinimum(45000, 60000);
  assert.equal(r.ok, false);
  assert.equal(r.shortByCents, 15000); // $150 to go
});

// ─── enforceProductMinQuantity ──────────────────────────────────

test("quantity at minimum → ok, shortBy 0", () => {
  const r = enforceProductMinQuantity(50, 50);
  assert.deepEqual(r, { ok: true, shortByUnits: 0 });
});

test("quantity above minimum → ok", () => {
  const r = enforceProductMinQuantity(75, 50);
  assert.deepEqual(r, { ok: true, shortByUnits: 0 });
});

test("quantity below minimum → not ok, reports shortfall", () => {
  const r = enforceProductMinQuantity(20, 50);
  assert.deepEqual(r, { ok: false, shortByUnits: 30 });
});

test("null minimum quantity → always ok", () => {
  const r = enforceProductMinQuantity(1, null);
  assert.deepEqual(r, { ok: true, shortByUnits: 0 });
});

test("fractional quantity truncated before comparison", () => {
  // 49.9 → 49 → below 50 by 1
  const r = enforceProductMinQuantity(49.9, 50);
  assert.deepEqual(r, { ok: false, shortByUnits: 1 });
});

test("negative quantity clamped to 0", () => {
  const r = enforceProductMinQuantity(-10, 50);
  assert.deepEqual(r, { ok: false, shortByUnits: 50 });
});

test("realistic chiavari chairs: 50-chair minimum, customer wants 30", () => {
  const r = enforceProductMinQuantity(30, 50);
  assert.equal(r.ok, false);
  assert.equal(r.shortByUnits, 20);
});
