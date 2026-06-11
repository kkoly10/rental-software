export type FinancialOrderShape = {
  total_amount: number | string | null;
  subtotal_amount: number | string | null;
  delivery_fee_amount: number | string | null;
  deposit_due_amount: number | string | null;
};

export type FinancialPaymentShape = {
  amount: number | string | null;
  payment_type: string | null;
  payment_status: string | null;
};

export type ComputedFinancials = {
  total: number;
  subtotal: number;
  deliveryFee: number;
  depositRequired: number;
  totalPaid: number;
  totalRefunded: number;
  depositFulfilled: boolean;
  remainingBalance: number;
};

export function computeOrderFinancials(
  order: FinancialOrderShape,
  payments: FinancialPaymentShape[]
): ComputedFinancials {
  const total = Number(order.total_amount ?? 0);
  const subtotal = Number(order.subtotal_amount ?? 0);
  const deliveryFee = Number(order.delivery_fee_amount ?? 0);
  const depositRequired = Number(order.deposit_due_amount ?? 0);

  // Accumulate in integer cents to avoid floating-point drift
  let totalPaidCents = 0;
  let totalRefundedCents = 0;

  for (const p of payments) {
    if (p.payment_status !== "paid") continue;
    const amtCents = Math.round(Number(p.amount ?? 0) * 100);
    if (p.payment_type === "refund") {
      totalRefundedCents += amtCents;
    } else if (p.payment_type === "damage_charge" || p.payment_type === "damage_refund") {
      // PR-2c — post-event damage charges are bookkeeping against
      // the customer, not a payment against the rental balance.
      // Counting them in totalPaid would inflate "amount paid" on
      // the order detail (and falsely flip depositFulfilled / clear
      // remainingBalance) by every post-event charge. PR-3e review
      // fix — damage_refund is the symmetric unwind: the webhook
      // sets this type when charge.refunded refers to a payment
      // intent we recognize as a damage_charge.
      continue;
    } else {
      totalPaidCents += amtCents;
    }
  }

  const totalCents = Math.round(total * 100);
  const depositRequiredCents = Math.round(depositRequired * 100);
  const netPaidCents = Math.max(0, totalPaidCents - totalRefundedCents);
  const remainingBalanceCents = Math.max(0, totalCents - netPaidCents);

  const netPaid = netPaidCents / 100;
  const totalRefunded = totalRefundedCents / 100;
  const remainingBalance = remainingBalanceCents / 100;
  const depositFulfilled = netPaidCents >= depositRequiredCents;

  return {
    total,
    subtotal,
    deliveryFee,
    depositRequired,
    totalPaid: netPaid,
    totalRefunded,
    depositFulfilled,
    remainingBalance,
  };
}
