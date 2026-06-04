"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getOrgFormatting } from "@/lib/i18n/org-formatting";

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

// Orders that represent a real, still-live booking (i.e. not a dead lead or a
// closed-out/refunded order). Used for outstanding balance and schedule counts.
const LIVE_STATUSES = [
  "confirmed",
  "scheduled",
  "out_for_delivery",
  "delivered",
];

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
      // Live orders: drives outstanding balance + schedule + balance-due-soon.
      supabase
        .from("orders")
        .select("id, order_status, event_date, balance_due_amount")
        .eq("organization_id", ctx.organizationId)
        .is("deleted_at", null)
        .in("order_status", LIVE_STATUSES)
        .limit(ACTIVE_ORDERS_LIMIT),

      // Payments collected this month (revenue source of truth, mirrors analytics).
      supabase
        .from("payments")
        .select("amount, payment_type, orders!inner(organization_id)")
        .eq("orders.organization_id", ctx.organizationId)
        .eq("payment_status", "paid")
        .gte("paid_at", monthStart)
        .limit(10000),

      // Unsigned paperwork for events that haven't happened yet.
      supabase
        .from("documents")
        .select("id, document_status, orders!inner(event_date, order_status)")
        .eq("organization_id", ctx.organizationId)
        .in("document_status", ["pending", "sent"])
        .gte("orders.event_date", today)
        .limit(2000),

      // Unread inbound customer messages.
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", ctx.organizationId)
        .eq("direction", "inbound")
        .eq("read", false),

      // Assets currently out of service.
      supabase
        .from("maintenance_records")
        .select("id, assets!inner(organization_id, deleted_at)", {
          count: "exact",
          head: true,
        })
        .eq("assets.organization_id", ctx.organizationId)
        .is("assets.deleted_at", null)
        .in("status", ["open", "in_progress", "service_due"]),
    ]);

  if (ordersRes.error)
    console.error("[operational-snapshot] orders query failed:", ordersRes.error.message);
  if (paymentsRes.error)
    console.error("[operational-snapshot] payments query failed:", paymentsRes.error.message);
  if (docsRes.error)
    console.error("[operational-snapshot] documents query failed:", docsRes.error.message);

  const orders = ordersRes.data ?? [];

  let outstandingBalance = 0;
  let eventsToday = 0;
  let eventsNext7Days = 0;
  let balanceDueSoonCount = 0;
  let balanceDueSoonTotal = 0;

  for (const o of orders) {
    const balance =
      typeof o.balance_due_amount === "number" ? o.balance_due_amount : 0;
    if (balance > 0) outstandingBalance += balance;

    const eventDate = o.event_date ?? null;
    if (eventDate === today) eventsToday += 1;
    if (eventDate && eventDate >= today && eventDate <= next7Str) {
      eventsNext7Days += 1;
      if (balance > 0) {
        balanceDueSoonCount += 1;
        balanceDueSoonTotal += balance;
      }
    }
  }

  let revenueThisMonth = 0;
  let paymentsThisMonthCount = 0;
  for (const p of paymentsRes.data ?? []) {
    const amt = typeof p.amount === "number" ? p.amount : 0;
    if (p.payment_type === "refund") {
      revenueThisMonth -= amt;
    } else {
      revenueThisMonth += amt;
      paymentsThisMonthCount += 1;
    }
  }
  revenueThisMonth = Math.max(0, revenueThisMonth);

  return {
    outstandingBalance: round2(outstandingBalance),
    revenueThisMonth: round2(revenueThisMonth),
    paymentsThisMonthCount,
    eventsToday,
    eventsNext7Days,
    balanceDueSoonCount,
    balanceDueSoonTotal: round2(balanceDueSoonTotal),
    unsignedDocsUpcoming: (docsRes.data ?? []).length,
    unreadMessages: unreadRes.count ?? 0,
    openMaintenance: maintenanceRes.count ?? 0,
    currency,
    locale,
    available: true,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
