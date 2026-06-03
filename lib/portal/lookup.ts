"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getOrderFinancials } from "@/lib/payments/financials";
import { hashPortalAccessToken, issuePortalAccessToken, isPortalTokenExpired } from "@/lib/portal/access-token";

export type PortalPayment = {
  date: string;
  amount: string;
  type: string;
};

export type PortalOrder = {
  orderNumber: string;
  status: string;
  eventDate: string;
  items: string[];
  subtotal: string;
  deliveryFee: string;
  total: string;
  depositDue: string;
  balanceDue: string;
  documents: { id: string; type: string; status: string }[];
  payments: PortalPayment[];
  deliveryDate?: string;
  deliveryTimeWindow?: string;
  customerName: string;
  /**
   * Sprint 5.5 — Equipment Condition rows for the customer portal.
   * Populated by `getOrderConditionRowsForPortal` against the same
   * supabase client that resolved the portal token.
   */
  conditionRows?: import("@/lib/data/equipment-condition").ConditionRow[];
};

export type PortalLookupState = {
  ok: boolean;
  message: string;
  order?: PortalOrder;
  portalToken?: string;
};

type OrderBase = {
  id: string;
  order_number: string;
  order_status: string;
  event_date: string | null;
  event_start_time: string | null;
  event_end_time: string | null;
  subtotal_amount: number | string | null;
  delivery_fee_amount: number | string | null;
  total_amount: number | string | null;
  deposit_due_amount: number | string | null;
  balance_due_amount: number | string | null;
  customer_id: string;
};

function formatMoney(val: number): string {
  return `$${val.toFixed(2)}`;
}

async function buildPortalOrder(
  order: OrderBase,
  customer: { first_name: string | null; last_name: string | null },
  orgId: string,
) {
  const { formatDateInTimeZone, formatTimeInTimeZone } = await import("@/lib/datetime/event-time");
  // Same anon-RLS issue: order_items, documents, payments have no anon SELECT,
  // so the cookie-bound client returns nothing and the portal renders an
  // empty order summary.
  const supabase = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();

  // Render times in the org's IANA timezone so customers see times
  // that match the operator's clock, not the server's.
  const { data: orgTzRow } = await supabase
    .from("organizations")
    .select("event_timezone")
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  const eventTimezone = orgTzRow?.event_timezone ?? "UTC";

  const [{ data: items }, { data: docs }, { data: paymentRows }] = await Promise.all([
    supabase.from("order_items").select("item_name_snapshot").eq("order_id", order.id),
    supabase
      .from("documents")
      .select("id, document_type, document_status")
      .eq("order_id", order.id),
    supabase
      .from("payments")
      .select("amount, payment_type, paid_at")
      .eq("order_id", order.id)
      .eq("payment_status", "paid")
      .order("paid_at", { ascending: true }),
  ]);

  const eventDate = order.event_date
    ? formatDateInTimeZone(`${order.event_date}T12:00:00Z`, eventTimezone, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";

  const statusLabels: Record<string, string> = {
    inquiry: "Inquiry",
    quote_sent: "Quote Sent",
    awaiting_deposit: "Awaiting Deposit",
    confirmed: "Confirmed",
    scheduled: "Scheduled",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };

  const financials = await getOrderFinancials(order.id);
  // Fall back to cached balance_due_amount column (kept current by record_manual_payment DB function)
  // rather than total_amount, which doesn't account for payments already received.
  const remainingBalance = financials?.remainingBalance ?? Number(order.balance_due_amount ?? order.total_amount ?? 0);

  return {
    orderNumber: order.order_number,
    status: statusLabels[order.order_status] ?? order.order_status,
    eventDate,
    items: (items ?? []).map((i) => i.item_name_snapshot ?? "Rental item"),
    subtotal: formatMoney(Number(order.subtotal_amount ?? 0)),
    deliveryFee: formatMoney(Number(order.delivery_fee_amount ?? 0)),
    total: formatMoney(Number(order.total_amount ?? 0)),
    depositDue: formatMoney(Number(order.deposit_due_amount ?? 0)),
    balanceDue: formatMoney(remainingBalance),
    documents: (docs ?? []).map((d) => ({
      id: d.id,
      type: (d.document_type ?? "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      status: d.document_status,
    })),
    payments: (paymentRows ?? []).map((p) => ({
      date: p.paid_at
        ? formatDateInTimeZone(p.paid_at, eventTimezone, { month: "short", day: "numeric", year: "numeric" })
        : "—",
      amount: formatMoney(Number(p.amount ?? 0)),
      type: (p.payment_type ?? "payment").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
    })),
    deliveryDate: ["scheduled", "out_for_delivery", "delivered"].includes(order.order_status) ? eventDate : undefined,
    deliveryTimeWindow: (() => {
      if (!["scheduled", "out_for_delivery", "delivered"].includes(order.order_status)) return undefined;
      if (order.event_start_time && order.event_end_time) {
        return `${formatTimeInTimeZone(order.event_start_time, eventTimezone)} – ${formatTimeInTimeZone(order.event_end_time, eventTimezone)}`;
      }
      return "See confirmation email for details";
    })(),
    customerName: `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Customer",
    // Sprint 5.5 — populated lazily by the lookup callers via
    // attachConditionRows below. Inline here so the satisfies-check
    // passes; the actual data is filled before the result is
    // returned to the page.
    conditionRows: undefined,
  } satisfies PortalOrder;
}

/**
 * Sprint 5.5 — attach equipment-condition rows to a built portal
 * order. Called by both `lookupOrderByPortalToken` and `lookupOrder`
 * after the order is built, so customer portal + magic-link both
 * surface the photos.
 */
async function attachConditionRows(
  portalOrder: PortalOrder,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  orgId: string,
  orderId: string,
): Promise<PortalOrder> {
  try {
    const { getOrderConditionRowsForPortal } = await import(
      "@/lib/data/equipment-condition"
    );
    portalOrder.conditionRows = await getOrderConditionRowsForPortal(
      supabase,
      orgId,
      orderId,
    );
  } catch (err) {
    // Photo surface is opportunistic — never block the rest of the
    // portal lookup on it. Log + leave undefined so the page renders
    // cleanly without the card.
    console.error(
      "[portal.lookup] attachConditionRows failed for",
      orderId,
      err instanceof Error ? err.message : err,
    );
  }
  return portalOrder;
}

export async function lookupOrderByPortalToken(token: string): Promise<PortalLookupState> {
  const normalized = token.trim();
  if (!normalized) return { ok: false, message: "Invalid portal link." };
  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: "",
      portalToken: normalized,
      order: {
        orderNumber: "ORD-2401",
        status: "Confirmed",
        eventDate: "Saturday, April 12, 2026",
        items: ["Tropical Bounce House"],
        subtotal: "$225.00",
        deliveryFee: "$45.00",
        total: "$270.00",
        depositDue: "$81.00",
        balanceDue: "$189.00",
        documents: [
          { id: "doc-demo-1", type: "Rental Agreement", status: "pending" },
          { id: "doc-demo-2", type: "Safety Waiver", status: "pending" },
        ],
        payments: [
          { date: "Mar 15, 2026", amount: "$81.00", type: "Deposit" },
        ],
        deliveryDate: "Saturday, April 12, 2026",
        deliveryTimeWindow: "8:00 AM – 10:00 AM",
        customerName: "Jane Smith",
      },
    };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) return { ok: false, message: "Service not available." };

  // Same anon-RLS issue as the email/order# lookup above — magic-link arrival
  // is also anonymous.
  const supabase = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();
  const tokenHash = hashPortalAccessToken(normalized);
  const { data: order } = await supabase
    .from("orders")
    .select(`
      id, order_number, order_status, event_date,
      event_start_time, event_end_time,
      subtotal_amount, delivery_fee_amount, total_amount,
      deposit_due_amount, balance_due_amount, customer_id,
      portal_access_token_created_at
    `)
    .eq("organization_id", orgId)
    .eq("portal_access_token_hash", tokenHash)
    .maybeSingle();

  if (!order) {
    return { ok: false, message: "This portal link is invalid or expired." };
  }

  if (isPortalTokenExpired(order.portal_access_token_created_at)) {
    return { ok: false, message: "This portal link has expired. Contact us to receive a new one." };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("first_name, last_name")
    .eq("id", order.customer_id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  const portalOrder = await buildPortalOrder(
    order,
    customer ?? { first_name: null, last_name: null },
    orgId,
  );
  // Sprint 5.5 — attach equipment-condition rows so the customer
  // portal renders the Equipment Condition card alongside the rest of
  // the order detail.
  await attachConditionRows(portalOrder, supabase, orgId, order.id);
  return {
    ok: true,
    message: "",
    portalToken: normalized,
    order: portalOrder,
  };
}

export async function lookupOrder(
  _prevState: PortalLookupState,
  formData: FormData
): Promise<PortalLookupState> {
  const orderNumber = String(formData.get("order_number") ?? "").trim().toUpperCase().slice(0, 50);
  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 254);

  if (!orderNumber || !email) {
    return { ok: false, message: "Please enter your order number and email." };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: "",
      portalToken: "demo-portal-token",
      order: {
        orderNumber: "ORD-2401",
        status: "Confirmed",
        eventDate: "Saturday, April 12, 2026",
        items: ["Tropical Bounce House"],
        subtotal: "$225.00",
        deliveryFee: "$45.00",
        total: "$270.00",
        depositDue: "$81.00",
        balanceDue: "$189.00",
        documents: [
          { id: "doc-demo-1", type: "Rental Agreement", status: "pending" },
          { id: "doc-demo-2", type: "Safety Waiver", status: "pending" },
        ],
        payments: [
          { date: "Mar 15, 2026", amount: "$81.00", type: "Deposit" },
        ],
        deliveryDate: "Saturday, April 12, 2026",
        deliveryTimeWindow: "8:00 AM – 10:00 AM",
        customerName: "Jane Smith",
      },
    };
  }

  try {
    const clientKey = await getActionClientKey();
    const [clientLimit, emailLimit] = await Promise.all([
      enforceRateLimit({ scope: "portal:lookup:client", actor: clientKey, limit: 10, windowSeconds: 900 }),
      enforceRateLimit({ scope: "portal:lookup:email", actor: email, limit: 5, windowSeconds: 900 }),
    ]);

    if (!clientLimit.allowed || !emailLimit.allowed) {
      return { ok: false, message: "Too many lookup attempts. Please try again in 15 minutes." };
    }
  } catch {
    return { ok: false, message: "Unable to look up orders right now." };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) {
    return { ok: false, message: "Service not available." };
  }

  // The customer portal is hit anonymously, and `orders` / `customers` have
  // no anon SELECT policies — so the cookie-bound client returns 0 rows and
  // every lookup says "Order not found." even with valid credentials. Use
  // admin when configured. Org isolation is enforced via the explicit
  // .eq("organization_id", orgId) on every read; orgId is host-resolved.
  const supabase = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();

  const { data: order } = await supabase
    .from("orders")
    .select(`
      id, order_number, order_status, event_date,
      event_start_time, event_end_time,
      subtotal_amount, delivery_fee_amount, total_amount,
      deposit_due_amount, balance_due_amount, customer_id
    `)
    .eq("organization_id", orgId)
    .eq("order_number", orderNumber)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) {
    return { ok: false, message: "Order not found. Please check your order number and email." };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("email, first_name, last_name")
    .eq("id", order.customer_id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!customer || customer.email?.toLowerCase() !== email) {
    return { ok: false, message: "Order not found. Please check your order number and email." };
  }

  const newPortalToken = await issuePortalAccessToken({ supabase, orderId: order.id });

  const portalOrder = await buildPortalOrder(order, customer, orgId);
  await attachConditionRows(portalOrder, supabase, orgId, order.id);
  return {
    ok: true,
    message: "",
    portalToken: newPortalToken,
    order: portalOrder,
  };
}
