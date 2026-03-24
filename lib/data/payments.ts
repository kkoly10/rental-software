import { mockOrders } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getPayments() {
  if (!hasSupabaseEnv()) {
    return mockOrders.map((order, index) => ({
      id: order.id,
      customer: order.customer,
      label:
        index === 0
          ? "$75 deposit paid"
          : index === 1
            ? "$0 unpaid"
            : "$170 due later",
      item: order.item,
      date: order.date,
    }));
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select("id, payment_type, payment_status, amount, paid_at, order_id")
    .order("paid_at", { ascending: false });

  if (error || !data) {
    return mockOrders.map((order, index) => ({
      id: order.id,
      customer: order.customer,
      label:
        index === 0
          ? "$75 deposit paid"
          : index === 1
            ? "$0 unpaid"
            : "$170 due later",
      item: order.item,
      date: order.date,
    }));
  }

  return data.map((payment) => ({
    id: payment.id,
    customer: payment.payment_type ?? "Payment",
    label:
      typeof payment.amount === "number"
        ? `$${payment.amount} ${payment.payment_status ?? "pending"}`
        : "$0 pending",
    item: payment.order_id ?? "Order",
    date: payment.paid_at ?? "TBD",
  }));
}
