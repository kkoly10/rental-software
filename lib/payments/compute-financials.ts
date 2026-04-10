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

  let totalPaid = 0;
  let totalRefunded = 0;

  for (const p of payments) {
    if (p.payment_status !== "paid") continue;
    const amt = Number(p.amount ?? 0);
    if (p.payment_type === "refund") {
      totalRefunded += amt;
    } else {
      totalPaid += amt;
    }
  }

  const netPaid = Number(Math.max(0, totalPaid - totalRefunded).toFixed(2));
  const remainingBalance = Number(Math.max(0, total - netPaid).toFixed(2));
  const depositFulfilled = netPaid >= depositRequired;

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
