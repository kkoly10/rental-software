import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  computeOrderFinancials,
  type ComputedFinancials,
  type FinancialPaymentShape,
} from "@/lib/payments/compute-financials";

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
export type OrderFinancials = ComputedFinancials;

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

  return computeOrderFinancials(order, (payments ?? []) as FinancialPaymentShape[]);
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

  return computeOrderFinancials(order, (payments ?? []) as FinancialPaymentShape[]);
}
