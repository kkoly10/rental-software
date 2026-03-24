import { mockOrders } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getOrders() {
  if (!hasSupabaseEnv()) {
    return mockOrders;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, order_status, event_date, total_amount")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return mockOrders;
  }

  return data.map((order) => ({
    id: order.id,
    customer: order.order_number ?? "Order",
    item: "Rental booking",
    date: order.event_date ?? "TBD",
    total: typeof order.total_amount === "number" ? `$${order.total_amount}` : "$0",
    status: order.order_status ?? "Inquiry",
    tone:
      order.order_status === "confirmed"
        ? "success"
        : order.order_status === "awaiting_deposit"
          ? "warning"
          : "default",
  }));
}
