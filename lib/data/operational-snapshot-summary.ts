/**
 * Pure aggregation helpers for the operator Copilot's operational snapshot.
 * Kept free of "use server" and Supabase imports so the math is unit-testable
 * in isolation (see tests/operational-snapshot-summary.test.ts).
 */

export type OpenOrderRow = {
  event_date: string | null;
  balance_due_amount: number | null;
};

export type OpenOrderSummary = {
  outstandingBalance: number;
  eventsToday: number;
  eventsNext7Days: number;
  balanceDueSoonCount: number;
  balanceDueSoonTotal: number;
};

/**
 * Reduce the set of open (non-closed) orders into the figures the Copilot
 * reports. `today` and `next7` are inclusive YYYY-MM-DD bounds; lexical
 * comparison is valid because both are zero-padded ISO dates.
 */
export function summarizeOpenOrders(
  orders: OpenOrderRow[],
  today: string,
  next7: string
): OpenOrderSummary {
  let outstandingBalance = 0;
  let eventsToday = 0;
  let eventsNext7Days = 0;
  let balanceDueSoonCount = 0;
  let balanceDueSoonTotal = 0;

  for (const o of orders) {
    const balance =
      typeof o.balance_due_amount === "number" ? o.balance_due_amount : 0;
    if (balance > 0) outstandingBalance += balance;

    const eventDate = o.event_date ?? null;
    if (!eventDate) continue;

    if (eventDate === today) eventsToday += 1;
    if (eventDate >= today && eventDate <= next7) {
      eventsNext7Days += 1;
      if (balance > 0) {
        balanceDueSoonCount += 1;
        balanceDueSoonTotal += balance;
      }
    }
  }

  return {
    outstandingBalance: round2(outstandingBalance),
    eventsToday,
    eventsNext7Days,
    balanceDueSoonCount,
    balanceDueSoonTotal: round2(balanceDueSoonTotal),
  };
}

export type PaymentRow = {
  amount: number | null;
  payment_type: string | null;
};

export type MonthPaymentSummary = {
  revenueThisMonth: number;
  paymentsThisMonthCount: number;
};

/**
 * Net this-month revenue from already-filtered paid payments. Refunds subtract
 * from revenue and don't count as inbound payments (mirrors analytics.ts).
 */
export function summarizeMonthPayments(
  payments: PaymentRow[]
): MonthPaymentSummary {
  let revenueThisMonth = 0;
  let paymentsThisMonthCount = 0;

  for (const p of payments) {
    const amt = typeof p.amount === "number" ? p.amount : 0;
    if (p.payment_type === "refund") {
      revenueThisMonth -= amt;
    } else {
      revenueThisMonth += amt;
      paymentsThisMonthCount += 1;
    }
  }

  return {
    revenueThisMonth: round2(Math.max(0, revenueThisMonth)),
    paymentsThisMonthCount,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
