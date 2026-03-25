import { mockOrders } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentSummary } from "@/lib/types";

const fallbackPayments: PaymentSummary[] = mockOrders.map((order, index) => ({
  id: order.id,
  customer: order.customer,
  label: index === 0 ? "$75 deposit paid" : index === 1 ? "$0 unpaid" : "$170 balance due",
  item: order.item,
  date: order.date,
  type: index === 0 ? "deposit" : "balance",
  status: index === 0 ? "paid" : "pending",
}));

export async function getPayments(): Promise<PaymentSummary[]> {
  if (!hasSupabaseEnv()) {
    return fallbackPayments;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, payment_type, payment_status, amount, paid_at, order_id, orders(order_number, customers(first_name, last_name))")
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (error || !data || data.length === 0) {
    return fallbackPayments;
  }

  return data.map((payment) => {
    const order = (payment as Record<string, unknown>).orders as { order_number: string; customers: { first_name: string; last_name: string } | null } | null;
    const customer = order?.customers;
    const type = payment.payment_type ?? "payment";
    const status = payment.payment_status ?? "pending";
    const amount = typeof payment.amount === "number" ? payment.amount : 0;

    return {
      id: payment.id,
      customer: customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : order?.order_number ?? "Order",
      label: `$${amount} ${type} ${status}`,
      item: order?.order_number ?? "N/A",
      date: payment.paid_at
        ? new Date(payment.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "Pending",
      type,
      status,
    };
  });
}
