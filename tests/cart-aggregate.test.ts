/**
 * Phase 3b — unit tests for the multi-item money aggregation
 * (lib/checkout/cart-aggregate.ts).
 *
 * The headline case is the spec's Risk-2 rounding scenario:
 * 3 × $99.99 + $30 delivery + tax must land on exact integer cents so the
 * single Stripe deposit line equals the computed deposit to the penny.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  sumItemSubtotalsCents,
  orderTotalCents,
} from "../lib/checkout/cart-aggregate.ts";

test("sums to exact cents (no float drift)", () => {
  // 3 × 99.99 = 299.97 → naive float sum is 299.97000000000003
  assert.equal(sumItemSubtotalsCents([99.99, 99.99, 99.99]), 29997);
});

test("each line is rounded before summing", () => {
  // 0.005 rounds to 1 cent per line → 3 cents, not 1 or 2.
  assert.equal(sumItemSubtotalsCents([0.005, 0.005, 0.005]), 3);
});

test("empty list sums to zero", () => {
  assert.equal(sumItemSubtotalsCents([]), 0);
});

test("order total: 3×$99.99 + $30 delivery + 10% tax lands on a cent boundary", () => {
  const subtotalCents = sumItemSubtotalsCents([99.99, 99.99, 99.99]); // 29997
  const deliveryFee = 30;
  // taxable base = 299.97 + 30 = 329.97 → 32997 cents
  // 10% tax of 32997 = 3299.7 → round → 3300 cents
  const taxCents = Math.round((subtotalCents / 100 + deliveryFee) * 100 * 0.1);
  const { taxableBaseCents, totalCents } = orderTotalCents({
    subtotalCents,
    deliveryFee,
    taxCents,
  });
  assert.equal(taxableBaseCents, 32997);
  assert.equal(taxCents, 3300);
  assert.equal(totalCents, 36297); // $362.97 exactly

  // Deposit at 30% of the integer total, with balance reconciling exactly.
  const depositCents = Math.round(totalCents * 0.3);
  const balanceCents = totalCents - depositCents;
  assert.equal(depositCents + balanceCents, totalCents);
  assert.equal(depositCents, 10889); // 36297 * 0.3 = 10889.1 → 10889
});

test("order total with zero delivery + zero tax equals the subtotal", () => {
  const subtotalCents = sumItemSubtotalsCents([50, 25.5]);
  const { totalCents } = orderTotalCents({ subtotalCents, deliveryFee: 0, taxCents: 0 });
  assert.equal(totalCents, 7550);
});
