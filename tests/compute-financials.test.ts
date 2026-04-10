import test from "node:test";
import assert from "node:assert/strict";
import { computeOrderFinancials } from "../lib/payments/compute-financials.ts";

test("computeOrderFinancials uses paid-only net and remaining balance", () => {
  const result = computeOrderFinancials(
    {
      total_amount: 250,
      subtotal_amount: 200,
      delivery_fee_amount: 50,
      deposit_due_amount: 100,
    },
    [
      { amount: 80, payment_type: "deposit", payment_status: "paid" },
      { amount: 40, payment_type: "card", payment_status: "paid" },
      { amount: 30, payment_type: "refund", payment_status: "paid" },
      { amount: 999, payment_type: "card", payment_status: "pending" },
    ]
  );

  assert.equal(result.totalPaid, 90);
  assert.equal(result.totalRefunded, 30);
  assert.equal(result.remainingBalance, 160);
  assert.equal(result.depositFulfilled, false);
});

test("computeOrderFinancials marks deposit fulfilled when net paid meets threshold", () => {
  const result = computeOrderFinancials(
    {
      total_amount: 300,
      subtotal_amount: 240,
      delivery_fee_amount: 60,
      deposit_due_amount: 75,
    },
    [{ amount: 75, payment_type: "deposit", payment_status: "paid" }]
  );

  assert.equal(result.depositFulfilled, true);
  assert.equal(result.remainingBalance, 225);
});
