import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type AnalyticsData = {
  // Financial
  totalRevenue: number;
  revenueThisMonth: number;
  outstandingBalance: number;
  averageOrderValue: number;
  depositCollectionRate: number;

  // Orders
  totalOrders: number;
  ordersThisMonth: number;
  ordersThisWeek: number;
  confirmedOrders: number;
  cancelledOrders: number;
  conversionRate: number;

  // Customers
  totalCustomers: number;
  repeatCustomers: number;
  newCustomersThisMonth: number;

  // Breakdowns
  revenueByMonth: { month: string; amount: number }[];
  ordersByStatus: { status: string; count: number }[];
  topProducts: { name: string; count: number; revenue: number }[];
  busiestDays: { day: string; count: number }[];
};

const EMPTY: AnalyticsData = {
  totalRevenue: 0,
  revenueThisMonth: 0,
  outstandingBalance: 0,
  averageOrderValue: 0,
  depositCollectionRate: 0,
  totalOrders: 0,
  ordersThisMonth: 0,
  ordersThisWeek: 0,
  confirmedOrders: 0,
  cancelledOrders: 0,
  conversionRate: 0,
  totalCustomers: 0,
  repeatCustomers: 0,
  newCustomersThisMonth: 0,
  revenueByMonth: [],
  ordersByStatus: [],
  topProducts: [],
  busiestDays: [],
};

const ACTIVE_STATUSES = new Set([
  "confirmed",
  "scheduled",
  "out_for_delivery",
  "delivered",
  "completed",
]);

export async function getAnalytics(): Promise<AnalyticsData> {
  if (!hasSupabaseEnv()) return EMPTY;

  const ctx = await getOrgContext();
  if (!ctx) return EMPTY;

  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const [ordersRes, customersRes, paymentsRes, itemsRes, balanceRes, repeatRes, newCustRes] =
    await Promise.all([
      // All orders
      supabase
        .from("orders")
        .select("id, order_status, total_amount, deposit_due_amount, event_date, created_at")
        .eq("organization_id", ctx.organizationId)
        .limit(5000),

      // Customer count
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId)
        .is("deleted_at", null),

      // All paid payments (revenue source of truth)
      supabase
        .from("payments")
        .select("amount, paid_at, payment_type, order_id, orders!inner(organization_id)")
        .eq("orders.organization_id", ctx.organizationId)
        .eq("payment_status", "paid")
        .limit(10000),

      // Order items (exclude cancelled orders for accurate product stats)
      supabase
        .from("order_items")
        .select(
          "item_name_snapshot, quantity, unit_price, orders!inner(organization_id, order_status)"
        )
        .eq("orders.organization_id", ctx.organizationId)
        .not("orders.order_status", "eq", "cancelled")
        .limit(5000),

      // Outstanding balance: sum of balance_due_amount for non-cancelled orders
      // This uses the cached column which is kept in sync by recordPayment().
      // For a perfectly accurate number we'd batch-call getOrderFinancials(),
      // but for analytics overview the cached value is acceptable.
      supabase
        .from("orders")
        .select("balance_due_amount")
        .eq("organization_id", ctx.organizationId)
        .not("order_status", "in", "(cancelled,completed,refunded)")
        .limit(5000),

      // Repeat customers: fetch customer_id from all orders to count in JS
      supabase
        .from("orders")
        .select("customer_id")
        .eq("organization_id", ctx.organizationId)
        .not("order_status", "eq", "cancelled")
        .limit(5000),

      // New customers this month
      supabase
        .from("customers")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId)
        .is("deleted_at", null)
        .gte("created_at", monthStart),
    ]);

  const orders = ordersRes.data ?? [];
  const payments = paymentsRes.data ?? [];
  const items = itemsRes.data ?? [];

  // --- Financial metrics ---

  // Revenue = sum of paid payments (excluding refunds) minus refunds
  let grossPaid = 0;
  let totalRefunded = 0;
  let grossPaidThisMonth = 0;
  let paidOrderIds = new Set<string>();

  for (const p of payments) {
    const amt = typeof p.amount === "number" ? p.amount : 0;
    if (p.payment_type === "refund") {
      totalRefunded += amt;
    } else {
      grossPaid += amt;
      paidOrderIds.add(p.order_id);

      if (p.paid_at && p.paid_at >= monthStart) {
        grossPaidThisMonth += amt;
      }
    }
  }

  const totalRevenue = Math.max(0, grossPaid - totalRefunded);
  const revenueThisMonth = Math.max(0, grossPaidThisMonth);

  // Outstanding balance from cached column
  const outstandingBalance = (balanceRes.data ?? []).reduce(
    (sum, o) => sum + (typeof o.balance_due_amount === "number" ? o.balance_due_amount : 0),
    0
  );

  // Average order value = total revenue / orders that have at least one payment
  const paidOrderCount = paidOrderIds.size;
  const averageOrderValue = paidOrderCount > 0 ? totalRevenue / paidOrderCount : 0;

  // Deposit collection rate
  const ordersWithDeposit = orders.filter(
    (o) => typeof o.deposit_due_amount === "number" && o.deposit_due_amount > 0
  );
  // An order's deposit is "fulfilled" if it has payments >= deposit_due_amount
  // Use a simplified check: order exists in paidOrderIds
  const depositFulfilledCount = ordersWithDeposit.filter((o) =>
    paidOrderIds.has(o.id)
  ).length;
  const depositCollectionRate =
    ordersWithDeposit.length > 0
      ? (depositFulfilledCount / ordersWithDeposit.length) * 100
      : 0;

  // --- Order metrics ---

  const totalOrders = orders.length;
  const confirmedOrders = orders.filter((o) =>
    ACTIVE_STATUSES.has(o.order_status ?? "")
  ).length;
  const cancelledOrders = orders.filter(
    (o) => o.order_status === "cancelled"
  ).length;
  const conversionRate = totalOrders > 0 ? (confirmedOrders / totalOrders) * 100 : 0;

  const ordersThisMonth = orders.filter(
    (o) => o.created_at && o.created_at >= monthStart
  ).length;
  const ordersThisWeek = orders.filter(
    (o) => o.created_at && o.created_at.slice(0, 10) >= weekStartStr
  ).length;

  // --- Customer metrics ---

  const totalCustomers = customersRes.count ?? 0;
  // Count repeat customers: customers with > 1 non-cancelled order
  const customerOrderCounts = new Map<string, number>();
  for (const o of (repeatRes.data ?? [])) {
    if (o.customer_id) {
      customerOrderCounts.set(
        o.customer_id,
        (customerOrderCounts.get(o.customer_id) ?? 0) + 1
      );
    }
  }
  const repeatCustomers = Array.from(customerOrderCounts.values()).filter(
    (c) => c > 1
  ).length;
  const newCustomersThisMonth = newCustRes.count ?? 0;

  // --- Revenue by month (last 6 months) ---

  const monthMap = new Map<string, number>();
  for (const p of payments) {
    if (p.paid_at && p.payment_type !== "refund") {
      const m = p.paid_at.slice(0, 7);
      monthMap.set(m, (monthMap.get(m) ?? 0) + (typeof p.amount === "number" ? p.amount : 0));
    }
  }
  const revenueByMonth = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([month, amount]) => ({ month, amount: round2(amount) }));

  // --- Orders by status ---

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

  // --- Top products (exclude cancelled) ---

  const productMap = new Map<string, { count: number; revenue: number }>();
  for (const item of items) {
    const name = item.item_name_snapshot ?? "Unknown";
    const qty = typeof item.quantity === "number" ? item.quantity : 1;
    const price = typeof item.unit_price === "number" ? item.unit_price : 0;
    const existing = productMap.get(name) ?? { count: 0, revenue: 0 };
    existing.count += qty;
    existing.revenue += price * qty;
    productMap.set(name, existing);
  }
  const topProducts = Array.from(productMap.entries())
    .map(([name, data]) => ({
      name,
      count: data.count,
      revenue: round2(data.revenue),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // --- Busiest days of the week ---

  const dayCountMap = new Map<number, number>();
  for (const o of orders) {
    if (o.event_date && ACTIVE_STATUSES.has(o.order_status ?? "")) {
      const dayOfWeek = new Date(`${o.event_date}T12:00:00`).getDay();
      dayCountMap.set(dayOfWeek, (dayCountMap.get(dayOfWeek) ?? 0) + 1);
    }
  }
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const busiestDays = Array.from(dayCountMap.entries())
    .map(([day, count]) => ({ day: dayNames[day], count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalRevenue: round2(totalRevenue),
    revenueThisMonth: round2(revenueThisMonth),
    outstandingBalance: round2(outstandingBalance),
    averageOrderValue: round2(averageOrderValue),
    depositCollectionRate: Math.round(depositCollectionRate * 10) / 10,
    totalOrders,
    ordersThisMonth,
    ordersThisWeek,
    confirmedOrders,
    cancelledOrders,
    conversionRate: Math.round(conversionRate * 10) / 10,
    totalCustomers,
    repeatCustomers,
    newCustomersThisMonth,
    revenueByMonth,
    ordersByStatus,
    topProducts,
    busiestDays,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
