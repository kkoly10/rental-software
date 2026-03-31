"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";

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
  deliveryDate?: string;
  deliveryTimeWindow?: string;
  customerName: string;
};

export type PortalLookupState = {
  ok: boolean;
  message: string;
  order?: PortalOrder;
};

function formatMoney(val: number): string {
  return `$${val.toFixed(2)}`;
}

export async function lookupOrder(
  _prevState: PortalLookupState,
  formData: FormData
): Promise<PortalLookupState> {
  const orderNumber = String(formData.get("order_number") ?? "").trim().toUpperCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!orderNumber || !email) {
    return { ok: false, message: "Please enter your order number and email." };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: "",
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
        deliveryDate: "Saturday, April 12, 2026",
        deliveryTimeWindow: "8:00 AM – 10:00 AM",
        customerName: "Jane Smith",
      },
    };
  }

  try {
    const clientKey = await getActionClientKey();
    const [clientLimit, emailLimit] = await Promise.all([
      enforceRateLimit({ scope: "portal:lookup:client", actor: clientKey, limit: 15, windowSeconds: 300 }),
      enforceRateLimit({ scope: "portal:lookup:email", actor: email, limit: 10, windowSeconds: 300 }),
    ]);

    if (!clientLimit.allowed || !emailLimit.allowed) {
      return { ok: false, message: "Too many lookup attempts. Please wait a moment." };
    }
  } catch {
    return { ok: false, message: "Unable to look up orders right now." };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) {
    return { ok: false, message: "Service not available." };
  }

  const supabase = await createSupabaseServerClient();

  // Find order by number + verify email matches customer
  const { data: order } = await supabase
    .from("orders")
    .select(`
      id, order_number, order_status, event_date,
      subtotal_amount, delivery_fee_amount, total_amount,
      deposit_due_amount, balance_due_amount,
      customer_id
    `)
    .eq("organization_id", orgId)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) {
    return { ok: false, message: "Order not found. Please check your order number." };
  }

  // Verify email matches
  const { data: customer } = await supabase
    .from("customers")
    .select("email, first_name, last_name")
    .eq("id", order.customer_id)
    .maybeSingle();

  if (!customer || customer.email?.toLowerCase() !== email) {
    return { ok: false, message: "Order not found. Please check your order number and email." };
  }

  // Fetch items
  const { data: items } = await supabase
    .from("order_items")
    .select("item_name_snapshot")
    .eq("order_id", order.id);

  // Fetch documents
  const { data: docs } = await supabase
    .from("documents")
    .select("id, document_type, document_status")
    .eq("order_id", order.id);

  const eventDate = order.event_date
    ? new Date(`${order.event_date}T12:00:00`).toLocaleDateString("en-US", {
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
  };

  return {
    ok: true,
    message: "",
    order: {
      orderNumber: order.order_number,
      status: statusLabels[order.order_status] ?? order.order_status,
      eventDate,
      items: (items ?? []).map((i) => i.item_name_snapshot ?? "Rental item"),
      subtotal: formatMoney(Number(order.subtotal_amount ?? 0)),
      deliveryFee: formatMoney(Number(order.delivery_fee_amount ?? 0)),
      total: formatMoney(Number(order.total_amount ?? 0)),
      depositDue: formatMoney(Number(order.deposit_due_amount ?? 0)),
      balanceDue: formatMoney(Number(order.balance_due_amount ?? 0)),
      documents: (docs ?? []).map((d) => ({
        id: d.id,
        type: (d.document_type ?? "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
        status: d.document_status,
      })),
      deliveryDate: ["scheduled", "out_for_delivery", "delivered"].includes(order.order_status) ? eventDate : undefined,
      deliveryTimeWindow: ["scheduled", "out_for_delivery", "delivered"].includes(order.order_status) ? "8:00 AM – 10:00 AM" : undefined,
      customerName: `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Customer",
    },
  };
}
