import { mockOrders } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import type { OrderSummary } from "@/lib/types";

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusTone(status: string): OrderSummary["tone"] {
  if (status === "confirmed" || status === "completed" || status === "delivered") return "success";
  if (status === "awaiting_deposit" || status === "quote_sent") return "warning";
  if (status === "cancelled" || status === "refunded") return "danger";
  return "default";
}

export async function getOrders(): Promise<OrderSummary[]> {
  if (!hasSupabaseEnv()) {
    return mockOrders;
  }

  const ctx = await getOrgContext();
  if (!ctx) return mockOrders;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, order_status, event_date, total_amount, customers(first_name, last_name), order_items(item_name_snapshot)")
    .eq("organization_id", ctx.organizationId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) {
    return mockOrders;
  }

  return data.map((order) => {
    const customer = (order as Record<string, unknown>).customers as { first_name: string; last_name: string } | null;
    const items = ((order as Record<string, unknown>).order_items as { item_name_snapshot: string }[] | null) ?? [];
    const status = order.order_status ?? "inquiry";

    return {
      id: order.id,
      customer: customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() : order.order_number ?? "Order",
      item: items.length > 0 ? items.map((i) => i.item_name_snapshot).filter(Boolean).join(", ") : "Rental booking",
      date: order.event_date
        ? new Date(order.event_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "TBD",
      total: typeof order.total_amount === "number" ? `$${order.total_amount}` : "$0",
      status: formatStatus(status),
      tone: statusTone(status),
    };
  });
}
