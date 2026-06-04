"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getOrgFormatting } from "@/lib/i18n/org-formatting";
import {
  summarizeMonthPayments,
  summarizeOpenOrders,
} from "@/lib/data/operational-snapshot-summary";

/**
 * A live, read-only snapshot of the things an operator most often needs to
 * act on: money owed, what is happening today/this week, and the small pile
 * of tasks that block an event from going out the door (unpaid balances,
 * unsigned paperwork, unread customer messages, assets in maintenance).
 *
 * This is intentionally separate from `getAnalytics()` (which powers the
 * Analytics page and is heavier) — the Copilot calls this on every message,
 * so it stays a tight, bounded set of parallel queries.
 */
export type OperationalSnapshot = {
  // Money
  outstandingBalance: number;
  revenueThisMonth: number;
  paymentsThisMonthCount: number;

  // Schedule
  eventsToday: number;
  eventsNext7Days: number;

  // Attention items (things blocking an upcoming event)
  balanceDueSoonCount: number; // active orders, event within 7 days, balance owed
  balanceDueSoonTotal: number; // sum of those balances
  unsignedDocsUpcoming: number; // pending/sent agreements or waivers for upcoming events
  unreadMessages: number;
  openMaintenance: number;

  // Formatting hints so the context layer renders money correctly
  currency: string;
  locale: string;

  // True when Supabase isn't configured (demo mode) — context layer can
  // then avoid presenting zeros as if they were real business numbers.
  available: boolean;
};

const EMPTY: OperationalSnapshot = {
  outstandingBalance: 0,
  revenueThisMonth: 0,
  paymentsThisMonthCount: 0,
  eventsToday: 0,
  eventsNext7Days: 0,
  balanceDueSoonCount: 0,
  balanceDueSoonTotal: 0,
  unsignedDocsUpcoming: 0,
  unreadMessages: 0,
  openMaintenance: 0,
  currency: "USD",
  locale: "en",
  available: false,
};

// Order statuses that are fully closed out and therefore can't owe money or
// represent an upcoming event. Everything else (inquiry → delivered) is "open"
// and counts toward outstanding balance + the schedule. This mirrors the
// Analytics page's outstanding-balance definition so the two surfaces agree.
const CLOSED_STATUSES = "(cancelled,completed,refunded)";

// Cap the active-orders pull so a huge book of business can't blow up the
// Copilot request. Operators well past this won't get exact attention counts,
// but the figures are directional guidance, not accounting.
const ACTIVE_ORDERS_LIMIT = 2000;

export async function getOperationalSnapshot(): Promise<OperationalSnapshot> {
  if (!hasSupabaseEnv()) return EMPTY;

  const ctx = await getOrgContext();
  if (!ctx) return EMPTY;

  const supabase = await createSupabaseServerClient();
  const { currency, locale } = await getOrgFormatting();

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const next7 = new Date(now);
  next7.setDate(next7.getDate() + 7);
  const next7Str = next7.toISOString().slice(0, 10);

  const [ordersRes, paymentsRes, docsRes, unreadRes, maintenanceRes] =
    await Promise.all([
      // Open orders: drives outstanding balance + schedule + balance-due-soon.
      // Excludes only the closed-out statuses, matching analytics.ts.
      supabase
        .from("orders")
        .select("id, event_date, balance_due_amount")
        .eq("organization_id", ctx.organizationId)
        .is("deleted_at", null)
        .not("order_status", "in", CLOSED_STATUSES)
        .limit(ACTIVE_ORDERS_LIMIT),

      // Payments collected this month (revenue source of truth, mirrors analytics).
      supabase
        .from("payments")
        .select("amount, payment_type, orders!inner(organization_id)")
        .eq("orders.organization_id", ctx.organizationId)
        .eq("payment_status", "paid")
        .gte("paid_at", monthStart)
        .limit(10000),

      // Unsigned paperwork (pending/sent, not signed/void) for upcoming events
      // on orders that are still open.
      supabase
        .from("documents")
        .select("id, orders!inner(event_date, order_status)", {
          count: "exact",
          head: true,
        })
        .eq("organization_id", ctx.organizationId)
        .in("document_status", ["pending", "sent"])
        .gte("orders.event_date", today)
        .not("orders.order_status", "in", CLOSED_STATUSES),

      // Unread inbound customer messages.
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId)
        .eq("direction", "inbound")
        .eq("read", false),

      // Assets currently out of service. maintenance_records.status is one of
      // open / in_progress / resolved; the first two mean "still needs work".
      supabase
        .from("maintenance_records")
        .select("id, assets!inner(deleted_at)", {
          count: "exact",
          head: true,
        })
        .eq("organization_id", ctx.organizationId)
        .is("assets.deleted_at", null)
        .in("status", ["open", "in_progress"]),
    ]);

  if (ordersRes.error)
    console.error("[operational-snapshot] orders query failed:", ordersRes.error.message);
  if (paymentsRes.error)
    console.error("[operational-snapshot] payments query failed:", paymentsRes.error.message);
  if (docsRes.error)
    console.error("[operational-snapshot] documents query failed:", docsRes.error.message);

  const orderSummary = summarizeOpenOrders(ordersRes.data ?? [], today, next7Str);
  const paymentSummary = summarizeMonthPayments(paymentsRes.data ?? []);

  return {
    outstandingBalance: orderSummary.outstandingBalance,
    revenueThisMonth: paymentSummary.revenueThisMonth,
    paymentsThisMonthCount: paymentSummary.paymentsThisMonthCount,
    eventsToday: orderSummary.eventsToday,
    eventsNext7Days: orderSummary.eventsNext7Days,
    balanceDueSoonCount: orderSummary.balanceDueSoonCount,
    balanceDueSoonTotal: orderSummary.balanceDueSoonTotal,
    unsignedDocsUpcoming: docsRes.count ?? 0,
    unreadMessages: unreadRes.count ?? 0,
    openMaintenance: maintenanceRes.count ?? 0,
    currency,
    locale,
    available: true,
  };
}
