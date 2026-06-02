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
  orderId: string,
  organizationId?: string
): Promise<OrderFinancials | null> {
  const supabase = await createSupabaseServerClient();

  let orderQuery = supabase
    .from("orders")
    .select("total_amount, subtotal_amount, delivery_fee_amount, deposit_due_amount")
    .eq("id", orderId)
    .is("deleted_at", null);
  if (organizationId) {
    orderQuery = orderQuery.eq("organization_id", organizationId);
  }

  const [{ data: order }, { data: payments }] = await Promise.all([
    orderQuery.maybeSingle(),
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
      .is("deleted_at", null)
      .maybeSingle(),
    admin
      .from("payments")
      .select("amount, payment_type, payment_status")
      .eq("order_id", orderId),
  ]);

  if (!order) return null;

  return computeOrderFinancials(order, (payments ?? []) as FinancialPaymentShape[]);
}

/**
 * Batch variant for screens that need financials for many orders at once
 * (CSV export, analytics rollups). Replaces a per-order Promise.all of
 * getOrderFinancials — for N orders that was 2*N round-trips; this is
 * exactly 2 round-trips regardless of N.
 *
 * Returns a Map keyed by order_id. Orders not present in the orders
 * table (soft-deleted, wrong org) are omitted from the result.
 */
export async function getOrderFinancialsBatch(
  orderIds: string[],
  organizationId?: string
): Promise<Map<string, OrderFinancials>> {
  const result = new Map<string, OrderFinancials>();
  if (orderIds.length === 0) return result;

  const supabase = await createSupabaseServerClient();

  let orderQuery = supabase
    .from("orders")
    .select("id, total_amount, subtotal_amount, delivery_fee_amount, deposit_due_amount")
    .in("id", orderIds)
    .is("deleted_at", null);
  if (organizationId) {
    orderQuery = orderQuery.eq("organization_id", organizationId);
  }

  const [{ data: orders }, { data: payments }] = await Promise.all([
    orderQuery,
    supabase
      .from("payments")
      .select("order_id, amount, payment_type, payment_status")
      .in("order_id", orderIds),
  ]);

  if (!orders) return result;

  // Group payments by order_id in a single pass.
  const paymentsByOrder = new Map<string, FinancialPaymentShape[]>();
  for (const p of (payments ?? []) as Array<FinancialPaymentShape & { order_id: string }>) {
    const list = paymentsByOrder.get(p.order_id) ?? [];
    list.push({ amount: p.amount, payment_type: p.payment_type, payment_status: p.payment_status });
    paymentsByOrder.set(p.order_id, list);
  }

  for (const order of orders as Array<{
    id: string;
    total_amount: number | string | null;
    subtotal_amount: number | string | null;
    delivery_fee_amount: number | string | null;
    deposit_due_amount: number | string | null;
  }>) {
    result.set(
      order.id,
      computeOrderFinancials(order, paymentsByOrder.get(order.id) ?? [])
    );
  }

  return result;
}
