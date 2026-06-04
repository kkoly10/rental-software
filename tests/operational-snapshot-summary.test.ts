import test from "node:test";
import assert from "node:assert/strict";
import {
  summarizeMonthPayments,
  summarizeOpenOrders,
} from "../lib/data/operational-snapshot-summary.ts";

const TODAY = "2026-06-04";
const NEXT7 = "2026-06-11";

test("summarizeOpenOrders sums outstanding balance across all open orders", () => {
  const result = summarizeOpenOrders(
    [
      { event_date: "2026-07-01", balance_due_amount: 100 },
      { event_date: "2026-05-01", balance_due_amount: 50 },
      { event_date: null, balance_due_amount: 25 },
      { event_date: "2026-08-01", balance_due_amount: 0 },
    ],
    TODAY,
    NEXT7
  );

  // 100 + 50 + 25 (a null event date still owes money), 0 ignored.
  assert.equal(result.outstandingBalance, 175);
});

test("summarizeOpenOrders counts events today and within the next 7 days", () => {
  const result = summarizeOpenOrders(
    [
      { event_date: TODAY, balance_due_amount: 0 },
      { event_date: TODAY, balance_due_amount: 40 },
      { event_date: "2026-06-08", balance_due_amount: 0 },
      { event_date: NEXT7, balance_due_amount: 0 }, // boundary, inclusive
      { event_date: "2026-06-12", balance_due_amount: 0 }, // just outside window
      { event_date: "2026-06-03", balance_due_amount: 99 }, // yesterday — not upcoming
    ],
    TODAY,
    NEXT7
  );

  assert.equal(result.eventsToday, 2);
  assert.equal(result.eventsNext7Days, 4); // both today + 06-08 + 06-11
});

test("summarizeOpenOrders flags only upcoming orders that still owe a balance", () => {
  const result = summarizeOpenOrders(
    [
      { event_date: TODAY, balance_due_amount: 40 },
      { event_date: "2026-06-08", balance_due_amount: 60 },
      { event_date: "2026-06-08", balance_due_amount: 0 }, // paid, not flagged
      { event_date: "2026-06-03", balance_due_amount: 200 }, // past, not flagged
      { event_date: "2026-12-01", balance_due_amount: 500 }, // far future, not soon
    ],
    TODAY,
    NEXT7
  );

  assert.equal(result.balanceDueSoonCount, 2);
  assert.equal(result.balanceDueSoonTotal, 100);
});

test("summarizeOpenOrders handles an empty book of business", () => {
  const result = summarizeOpenOrders([], TODAY, NEXT7);
  assert.deepEqual(result, {
    outstandingBalance: 0,
    eventsToday: 0,
    eventsNext7Days: 0,
    balanceDueSoonCount: 0,
    balanceDueSoonTotal: 0,
  });
});

test("summarizeMonthPayments nets refunds out of revenue and excludes them from the count", () => {
  const result = summarizeMonthPayments([
    { amount: 200, payment_type: "deposit" },
    { amount: 150, payment_type: "card" },
    { amount: 50, payment_type: "refund" },
  ]);

  assert.equal(result.revenueThisMonth, 300); // 200 + 150 - 50
  assert.equal(result.paymentsThisMonthCount, 2); // refund not counted
});

test("summarizeMonthPayments never reports negative revenue", () => {
  const result = summarizeMonthPayments([
    { amount: 100, payment_type: "card" },
    { amount: 250, payment_type: "refund" },
  ]);

  assert.equal(result.revenueThisMonth, 0);
  assert.equal(result.paymentsThisMonthCount, 1);
});
