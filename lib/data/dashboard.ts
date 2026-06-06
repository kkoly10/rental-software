import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getOrgFormatting } from "@/lib/i18n/org-formatting";
import { formatMoney, formatEventDate } from "@/lib/i18n/format-helpers";
import type { OrderSummary } from "@/lib/types";
import { mockOrders } from "@/lib/mock-data";

export type DashboardSummaryData = {
  todayBookings: number;
  upcomingDeliveries: number;
  activeProducts: number;
  recentPaymentsCount: number;
  recentOrders: OrderSummary[];
  /** Real 14-day daily series for the flow-metric sparklines (oldest→newest).
      Empty when there's no signal — the card then renders without a chart. */
  bookingsSeries: number[];
  paymentsSeries: number[];
};

// Count timestamps into `days` daily buckets ending today (oldest→newest, UTC).
function bucketDaily(dates: (string | null | undefined)[], days = 14): number[] {
  const buckets = new Array<number>(days).fill(0);
  const now = new Date();
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d);
    if (Number.isNaN(t.getTime())) continue;
    const day = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
    const idx = days - 1 - Math.round((end - day) / 86400000);
    if (idx >= 0 && idx < days) buckets[idx] += 1;
  }
  return buckets;
}

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
      // Demo-mode sample shapes so the sparkline affordance is visible.
      bookingsSeries: [1, 0, 2, 1, 3, 1, 2, 0, 2, 4, 1, 3, 2, 5],
      paymentsSeries: [0, 1, 0, 2, 1, 1, 3, 0, 1, 2, 2, 1, 3, 2],
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
      bookingsSeries: [],
      paymentsSeries: [],
    };
  }

  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const { currency, locale } = await getOrgFormatting();

  // Compute a date 7 days from now for upcoming deliveries
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().slice(0, 10);

  // 14-day window start (date-only) for the bookings event_date series.
  const fourteenAgo = new Date();
  fourteenAgo.setUTCDate(fourteenAgo.getUTCDate() - 13);
  const fourteenAgoStr = fourteenAgo.toISOString().slice(0, 10);
  const fourteenAgoIso = new Date(Date.now() - 14 * 86400000).toISOString();

  const [todayRes, upcomingRes, productsRes, paymentsRes, recentRes, bookingsSeriesRes, paymentsSeriesRes] =
    await Promise.all([
      // Today's bookings: orders with event_date = today and active statuses
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId)
        .eq("event_date", today)
        .is("deleted_at", null)
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
        .is("deleted_at", null)
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
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(3),

      // Bookings sparkline: orders by event_date over the last 14 days
      supabase
        .from("orders")
        .select("event_date")
        .eq("organization_id", ctx.organizationId)
        .is("deleted_at", null)
        .gte("event_date", fourteenAgoStr)
        .lte("event_date", today),

      // Payments sparkline: paid payments over the last 14 days
      supabase
        .from("payments")
        .select("paid_at, orders!inner(organization_id)")
        .eq("orders.organization_id", ctx.organizationId)
        .eq("payment_status", "paid")
        .gte("paid_at", fourteenAgoIso),
    ]);

  if (todayRes.error) console.error("[dashboard] today bookings query failed:", todayRes.error.message);
  if (upcomingRes.error) console.error("[dashboard] upcoming deliveries query failed:", upcomingRes.error.message);
  if (productsRes.error) console.error("[dashboard] products query failed:", productsRes.error.message);
  if (paymentsRes.error) console.error("[dashboard] payments query failed:", paymentsRes.error.message);
  if (recentRes.error) console.error("[dashboard] recent orders query failed:", recentRes.error.message);
  if (bookingsSeriesRes.error) console.error("[dashboard] bookings series query failed:", bookingsSeriesRes.error.message);
  if (paymentsSeriesRes.error) console.error("[dashboard] payments series query failed:", paymentsSeriesRes.error.message);

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
        ? formatEventDate(o.event_date, locale, {
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })
        : "No date",
      total: formatMoney(Number(o.total_amount ?? 0), currency, locale),
      status: formatStatus(status),
      tone: statusTone(status),
    };
  });

  const bookingsSeries = bucketDaily(
    (bookingsSeriesRes.data ?? []).map((r) => (r as { event_date?: string | null }).event_date),
    14
  );
  const paymentsSeries = bucketDaily(
    (paymentsSeriesRes.data ?? []).map((r) => (r as { paid_at?: string | null }).paid_at),
    14
  );

  return {
    todayBookings: todayRes.count ?? 0,
    upcomingDeliveries: upcomingRes.count ?? 0,
    activeProducts: productsRes.count ?? 0,
    recentPaymentsCount: paymentsRes.count ?? 0,
    recentOrders,
    bookingsSeries,
    paymentsSeries,
  };
}
