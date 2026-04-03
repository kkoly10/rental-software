import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Canonical order financials — ALWAYS computed from the orders + payments tables.
 *
 * Rules:
 *  - total_amount is set once at order creation and never mutated.
 *  - deposit_due_amount is the deposit the operator requires (set at creation).
 *  - totalPaid = SUM(payments.amount) WHERE payment_status = 'paid' AND payment_type != 'refund'
 *               minus SUM(payments.amount) WHERE payment_status = 'paid' AND payment_type = 'refund'
 *  - remainingBalance = total_amount - totalPaid  (never stored; always computed)
 *  - depositFulfilled = totalPaid >= deposit_due_amount
 *
 * Every UI that shows money (order detail, customer portal, invoice PDF,
 * checkout summary) MUST call this function instead of reading balance_due_amount.
 */
export type OrderFinancials = {
  total: number;
  subtotal: number;
  deliveryFee: number;
  depositRequired: number;
  totalPaid: number;
  totalRefunded: number;
  depositFulfilled: boolean;
  remainingBalance: number;
};

export async function getOrderFinancials(
  orderId: string
): Promise<OrderFinancials | null> {
  const supabase = await createSupabaseServerClient();

  const [{ data: order }, { data: payments }] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "total_amount, subtotal_amount, delivery_fee_amount, deposit_due_amount"
      )
      .eq("id", orderId)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("amount, payment_type, payment_status")
      .eq("order_id", orderId),
  ]);

  if (!order) return null;

  return computeFinancials(order, payments ?? []);
}

/**
 * Variant that accepts a pre-fetched Supabase admin client (for webhook / API routes
 * that don't have a user session).
 */
export async function getOrderFinancialsAdmin(
  admin: ReturnType<typeof import("@/lib/supabase/admin").createSupabaseAdminClient>,
  orderId: string
): Promise<OrderFinancials | null> {
  const [{ data: order }, { data: payments }] = await Promise.all([
    admin
      .from("orders")
      .select(
        "total_amount, subtotal_amount, delivery_fee_amount, deposit_due_amount"
      )
      .eq("id", orderId)
      .maybeSingle(),
    admin
      .from("payments")
      .select("amount, payment_type, payment_status")
      .eq("order_id", orderId),
  ]);

  if (!order) return null;

  return computeFinancials(order, payments ?? []);
}

function computeFinancials(
  order: {
    total_amount: number | string | null;
    subtotal_amount: number | string | null;
    delivery_fee_amount: number | string | null;
    deposit_due_amount: number | string | null;
  },
  payments: { amount: number | string | null; payment_type: string | null; payment_status: string | null }[]
): OrderFinancials {
  const total = Number(order.total_amount ?? 0);
  const subtotal = Number(order.subtotal_amount ?? 0);
  const deliveryFee = Number(order.delivery_fee_amount ?? 0);
  const depositRequired = Number(order.deposit_due_amount ?? 0);

  // Only count payments that are confirmed paid
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

  // Net paid = payments received minus refunds issued
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
