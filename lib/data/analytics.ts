import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type AnalyticsData = {
  totalRevenue: number;
  totalOrders: number;
  confirmedOrders: number;
  cancelledOrders: number;
  averageOrderValue: number;
  totalCustomers: number;
  conversionRate: number; // confirmed / total
  revenueByMonth: { month: string; amount: number }[];
  ordersByStatus: { status: string; count: number }[];
  topProducts: { name: string; count: number; revenue: number }[];
};

const EMPTY: AnalyticsData = {
  totalRevenue: 0,
  totalOrders: 0,
  confirmedOrders: 0,
  cancelledOrders: 0,
  averageOrderValue: 0,
  totalCustomers: 0,
  conversionRate: 0,
  revenueByMonth: [],
  ordersByStatus: [],
  topProducts: [],
};

export async function getAnalytics(): Promise<AnalyticsData> {
  if (!hasSupabaseEnv()) return EMPTY;

  const ctx = await getOrgContext();
  if (!ctx) return EMPTY;

  const supabase = await createSupabaseServerClient();

  const [ordersRes, customersRes, paymentsRes, itemsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id, order_status, total_amount, event_date, created_at")
      .eq("organization_id", ctx.organizationId)
      .limit(5000),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null),
    supabase
      .from("payments")
      .select("amount, paid_at, orders!inner(organization_id)")
      .eq("orders.organization_id", ctx.organizationId)
      .eq("payment_status", "paid")
      .limit(5000),
    supabase
      .from("order_items")
      .select("item_name_snapshot, quantity, unit_price_snapshot, orders!inner(organization_id, order_status)")
      .eq("orders.organization_id", ctx.organizationId)
      .limit(5000),
  ]);

  const orders = ordersRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const items = itemsRes.data ?? [];

  // Revenue from completed payments
  const totalRevenue = payments.reduce(
    (sum, p) => sum + (typeof p.amount === "number" ? p.amount : 0),
    0
  );

  const totalOrders = orders.length;
  const confirmedStatuses = new Set([
    "confirmed", "scheduled", "out_for_delivery", "delivered", "completed",
  ]);
  const confirmedOrders = orders.filter((o) =>
    confirmedStatuses.has(o.order_status ?? "")
  ).length;
  const cancelledOrders = orders.filter(
    (o) => o.order_status === "cancelled"
  ).length;

  const averageOrderValue =
    totalOrders > 0
      ? orders.reduce(
          (sum, o) => sum + (typeof o.total_amount === "number" ? o.total_amount : 0),
          0
        ) / totalOrders
      : 0;

  const conversionRate = totalOrders > 0 ? confirmedOrders / totalOrders : 0;

  // Revenue by month (last 6 months)
  const monthMap = new Map<string, number>();
  for (const p of payments) {
    if (p.paid_at) {
      const m = p.paid_at.slice(0, 7); // YYYY-MM
      monthMap.set(m, (monthMap.get(m) ?? 0) + (typeof p.amount === "number" ? p.amount : 0));
    }
  }
  const revenueByMonth = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }));

  // Orders by status
  const statusMap = new Map<string, number>();
  for (const o of orders) {
    const s = o.order_status ?? "inquiry";
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
  }
  const ordersByStatus = Array.from(statusMap.entries())
    .map(([status, count]) => ({
      status: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Top products by booking count
  const productMap = new Map<string, { count: number; revenue: number }>();
  for (const item of items) {
    const name = item.item_name_snapshot ?? "Unknown";
    const qty = typeof item.quantity === "number" ? item.quantity : 1;
    const price = typeof item.unit_price_snapshot === "number" ? item.unit_price_snapshot : 0;
    const existing = productMap.get(name) ?? { count: 0, revenue: 0 };
    existing.count += qty;
    existing.revenue += price * qty;
    productMap.set(name, existing);
  }
  const topProducts = Array.from(productMap.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      revenue: Math.round(data.revenue * 100) / 100,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalOrders,
    confirmedOrders,
    cancelledOrders,
    averageOrderValue: Math.round(averageOrderValue * 100) / 100,
    totalCustomers: customersRes.count ?? 0,
    conversionRate: Math.round(conversionRate * 1000) / 10,
    revenueByMonth,
    ordersByStatus,
    topProducts,
  };
}
