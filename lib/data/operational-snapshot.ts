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
// A specific order the operator should chase, with a deep-link to its detail
// page so the Copilot can surface a one-click reference instead of just a count.
export type AttentionOrder = {
  id: string;
  label: string; // e.g. "#1042 — Sarah Mitchell"
  balance: number;
  eventDate: string | null; // YYYY-MM-DD
  link: string; // /dashboard/orders/{id}
};

// An open order the Copilot can target for an action (e.g. advancing status).
// Carries the current status so the model can propose a valid next transition.
export type ActionableOrder = {
  id: string;
  label: string; // "#1042 — Sarah Mitchell"
  status: string; // current order_status
  eventDate: string | null;
  link: string;
};

// An unread inbound customer message the Copilot can draft a reply to.
export type UnreadThread = {
  customerName: string;
  customerEmail: string | null;
  customerId: string | null;
  orderId: string | null;
  orderNumber: string | null;
  snippet: string; // the customer's message (truncated)
  link: string; // /dashboard/messages
};

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

  // A few specific upcoming orders that still owe money, soonest first, each
  // with a deep-link — powers clickable "here's exactly what to chase" answers.
  attentionOrders: AttentionOrder[];

  // Open orders the Copilot can act on (status changes, etc.), soonest event
  // first, with their current status — so the model can target a real order.
  actionableOrders: ActionableOrder[];

  // Unread inbound customer messages the Copilot can draft replies to.
  unreadThreads: UnreadThread[];

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
  attentionOrders: [],
  actionableOrders: [],
  unreadThreads: [],
  currency: "USD",
  locale: "en",
  available: false,
};

// How many specific balance-due orders to surface with deep-links.
const ATTENTION_ORDERS_LIMIT = 5;
// How many open orders to surface as action targets (status changes, etc.).
const ACTIONABLE_ORDERS_LIMIT = 12;
// How many unread threads to surface as reply targets.
const UNREAD_THREADS_LIMIT = 5;
const MESSAGE_SNIPPET_MAX = 400;

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

  const [ordersRes, paymentsRes, docsRes, unreadRes, maintenanceRes, attentionRes, actionableRes] =
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

      // Unread inbound customer messages — count (exact) + the latest few rows
      // so the Copilot can draft contextual replies.
      supabase
        .from("messages")
        .select(
          "id, customer_id, sender_email, sender_name, order_id, body, created_at",
          { count: "exact" }
        )
        .eq("organization_id", ctx.organizationId)
        .eq("direction", "inbound")
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(UNREAD_THREADS_LIMIT),

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

      // The specific upcoming orders that still owe money, soonest event first —
      // surfaced as deep-linked references in the Copilot's answers.
      supabase
        .from("orders")
        .select(
          "id, order_number, event_date, balance_due_amount, customers(first_name, last_name, deleted_at)"
        )
        .eq("organization_id", ctx.organizationId)
        .is("deleted_at", null)
        .not("order_status", "in", CLOSED_STATUSES)
        .gte("event_date", today)
        .lte("event_date", next7Str)
        .gt("balance_due_amount", 0)
        .order("event_date", { ascending: true })
        .limit(ATTENTION_ORDERS_LIMIT),

      // Open orders the Copilot can target for actions (e.g. status changes),
      // soonest event first, with their current status.
      supabase
        .from("orders")
        .select(
          "id, order_number, order_status, event_date, customers(first_name, last_name, deleted_at)"
        )
        .eq("organization_id", ctx.organizationId)
        .is("deleted_at", null)
        .not("order_status", "in", CLOSED_STATUSES)
        .order("event_date", { ascending: true, nullsFirst: false })
        .limit(ACTIONABLE_ORDERS_LIMIT),
    ]);

  if (ordersRes.error)
    console.error("[operational-snapshot] orders query failed:", ordersRes.error.message);
  if (paymentsRes.error)
    console.error("[operational-snapshot] payments query failed:", paymentsRes.error.message);
  if (docsRes.error)
    console.error("[operational-snapshot] documents query failed:", docsRes.error.message);

  const orderSummary = summarizeOpenOrders(ordersRes.data ?? [], today, next7Str);
  const paymentSummary = summarizeMonthPayments(paymentsRes.data ?? []);

  const orderLabel = (o: Record<string, unknown>): string => {
    const customer = o.customers as
      | { first_name?: string | null; last_name?: string | null; deleted_at?: string | null }
      | null;
    const name =
      customer && !customer.deleted_at
        ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
        : "";
    const orderRef = o.order_number ? `#${o.order_number}` : "Order";
    return name ? `${orderRef} — ${name}` : orderRef;
  };

  const attentionOrders: AttentionOrder[] = (attentionRes.data ?? []).map((o) => ({
    id: o.id,
    label: orderLabel(o as Record<string, unknown>),
    balance: typeof o.balance_due_amount === "number" ? o.balance_due_amount : 0,
    eventDate: o.event_date ?? null,
    link: `/dashboard/orders/${o.id}`,
  }));

  const actionableOrders: ActionableOrder[] = (actionableRes.data ?? []).map((o) => ({
    id: o.id,
    label: orderLabel(o as Record<string, unknown>),
    status: o.order_status ?? "inquiry",
    eventDate: o.event_date ?? null,
    link: `/dashboard/orders/${o.id}`,
  }));

  // Resolve customer + order details for the unread inbound messages so the
  // Copilot can draft a reply (it needs the customer email + the message body).
  const unreadRows = unreadRes.data ?? [];
  const unreadThreads = await buildUnreadThreads(supabase, ctx.organizationId, unreadRows);

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
    attentionOrders,
    actionableOrders,
    unreadThreads,
    currency,
    locale,
    available: true,
  };
}

type UnreadRow = {
  id: string;
  customer_id: string | null;
  sender_email: string | null;
  sender_name: string | null;
  order_id: string | null;
  body: string | null;
};

async function buildUnreadThreads(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  rows: UnreadRow[]
): Promise<UnreadThread[]> {
  if (rows.length === 0) return [];

  const customerIds = [...new Set(rows.map((r) => r.customer_id).filter(Boolean) as string[])];
  const orderIds = [...new Set(rows.map((r) => r.order_id).filter(Boolean) as string[])];

  const [customersRes, ordersRes] = await Promise.all([
    customerIds.length > 0
      ? supabase
          .from("customers")
          .select("id, first_name, last_name, email")
          .in("id", customerIds)
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null }[] }),
    orderIds.length > 0
      ? supabase
          .from("orders")
          .select("id, order_number")
          .in("id", orderIds)
          .eq("organization_id", organizationId)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] as { id: string; order_number: string | null }[] }),
  ]);

  const customerMap = new Map(
    (customersRes.data ?? []).map((c) => [
      c.id,
      {
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || "",
        email: c.email,
      },
    ])
  );
  const orderMap = new Map((ordersRes.data ?? []).map((o) => [o.id, o.order_number]));

  return rows.map((r) => {
    const customer = r.customer_id ? customerMap.get(r.customer_id) : null;
    const snippet = (r.body ?? "").trim().slice(0, MESSAGE_SNIPPET_MAX);
    return {
      customerName: customer?.name || r.sender_name || r.sender_email || "Customer",
      customerEmail: customer?.email ?? r.sender_email ?? null,
      customerId: r.customer_id,
      orderId: r.order_id,
      orderNumber: r.order_id ? orderMap.get(r.order_id) ?? null : null,
      snippet,
      link: "/dashboard/messages",
    };
  });
}
