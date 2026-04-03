import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import type { OrderSummary } from "@/lib/types";
import { mockOrders } from "@/lib/mock-data";

export type DashboardSummaryData = {
  todayBookings: number;
  upcomingDeliveries: number;
  activeProducts: number;
  recentPaymentsCount: number;
  recentOrders: OrderSummary[];
};

function statusTone(status: string): OrderSummary["tone"] {
  if (status === "confirmed" || status === "completed" || status === "delivered") return "success";
  if (status === "awaiting_deposit" || status === "quote_sent") return "warning";
  if (status === "cancelled" || status === "refunded") return "danger";
  return "default";
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function getDashboardSummary(): Promise<DashboardSummaryData> {
  if (!hasSupabaseEnv()) {
    return {
      todayBookings: mockOrders.length,
      upcomingDeliveries: 0,
      activeProducts: 3,
      recentPaymentsCount: 0,
      recentOrders: mockOrders.slice(0, 3),
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return {
      todayBookings: 0,
      upcomingDeliveries: 0,
      activeProducts: 0,
      recentPaymentsCount: 0,
      recentOrders: [],
    };
  }

  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);

  // Compute a date 7 days from now for upcoming deliveries
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().slice(0, 10);

  const [todayRes, upcomingRes, productsRes, paymentsRes, recentRes] =
    await Promise.all([
      // Today's bookings: orders with event_date = today and active statuses
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId)
        .eq("event_date", today)
        .in("order_status", [
          "confirmed",
          "scheduled",
          "out_for_delivery",
          "delivered",
        ]),

      // Upcoming deliveries: confirmed/scheduled orders in the next 7 days
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId)
        .gte("event_date", today)
        .lte("event_date", nextWeekStr)
        .in("order_status", ["confirmed", "scheduled"]),

      // Active products count
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId)
        .eq("is_active", true)
        .is("deleted_at", null),

      // Recent payments (last 30 days)
      supabase
        .from("payments")
        .select("id, orders!inner(organization_id)", {
          count: "exact",
          head: true,
        })
        .eq("orders.organization_id", ctx.organizationId)
        .eq("payment_status", "paid")
        .gte(
          "paid_at",
          new Date(Date.now() - 30 * 86400000).toISOString()
        ),

      // 3 most recent orders for the list
      supabase
        .from("orders")
        .select(
          "id, order_number, order_status, event_date, total_amount, created_at, customers(first_name, last_name), order_items(item_name_snapshot)"
        )
        .eq("organization_id", ctx.organizationId)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

  const recentOrders: OrderSummary[] = (recentRes.data ?? []).map((o) => {
    const c = (o as Record<string, unknown>).customers as {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
    const items = (o as Record<string, unknown>).order_items as {
      item_name_snapshot?: string | null;
    }[] | null;
    const status = o.order_status ?? "inquiry";

    return {
      id: o.id,
      customer: c
        ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unknown"
        : "Unknown",
      item: items?.[0]?.item_name_snapshot ?? "Rental booking",
      date: o.event_date
        ? new Date(`${o.event_date}T12:00:00`).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "No date",
      total: `$${Number(o.total_amount ?? 0).toLocaleString()}`,
      status: formatStatus(status),
      tone: statusTone(status),
    };
  });

  return {
    todayBookings: todayRes.count ?? 0,
    upcomingDeliveries: upcomingRes.count ?? 0,
    activeProducts: productsRes.count ?? 0,
    recentPaymentsCount: paymentsRes.count ?? 0,
    recentOrders,
  };
}
