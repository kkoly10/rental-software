import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import type { OrderDetail } from "@/lib/types";

const fallbackOrderDetail: OrderDetail = {
  id: "ord_1001",
  orderNumber: "ORD-1001",
  status: "Confirmed",
  customerName: "Ashley Johnson",
  customerEmail: "ashley@example.com",
  customerPhone: "(540) 555-0102",
  eventDate: "May 24, 2026",
  items: ["Castle Bouncer", "Generator Add-on"],
  deliveryLabel: "123 Oak Lane, Stafford, VA 22554",
  documents: ["Rental Agreement: Signed", "Safety Waiver: Pending"],
  subtotal: "$225",
  deliveryFee: "$20",
  depositPaid: "$75",
  balanceDue: "$170",
  total: "$245",
  notes: "",
};

export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  if (!hasSupabaseEnv()) {
    return { ...fallbackOrderDetail, id: orderId };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ...fallbackOrderDetail, id: orderId };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, order_status, event_date, notes,
      subtotal_amount, delivery_fee_amount, total_amount,
      deposit_due_amount, balance_due_amount,
      customers(first_name, last_name, email, phone),
      order_items(item_name_snapshot, line_total),
      documents(document_type, document_status),
      customer_addresses(line1, city, state, postal_code)
    `)
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (error || !data) {
    return { ...fallbackOrderDetail, id: orderId };
  }

  const customer = (data as Record<string, unknown>).customers as {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  } | null;

  const items =
    ((data as Record<string, unknown>).order_items as
      | { item_name_snapshot: string; line_total: number }[]
      | null) ?? [];

  const docs =
    ((data as Record<string, unknown>).documents as
      | { document_type: string; document_status: string }[]
      | null) ?? [];

  const address = (data as Record<string, unknown>).customer_addresses as {
    line1: string;
    city: string;
    state: string;
    postal_code: string;
  } | null;

  const status = (data.order_status ?? "inquiry")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  return {
    id: data.id,
    orderNumber: data.order_number ?? "N/A",
    status,
    customerName: customer
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : "Unknown",
    customerEmail: customer?.email ?? "",
    customerPhone: customer?.phone ?? "",
    eventDate: data.event_date
      ? new Date(data.event_date + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "TBD",
    items:
      items.length > 0
        ? items.map((i) => i.item_name_snapshot ?? "Item")
        : ["No items added"],
    deliveryLabel: address
      ? `${address.line1}, ${address.city}, ${address.state} ${address.postal_code}`
      : "No delivery address on file",
    documents:
      docs.length > 0
        ? docs.map(
            (d) =>
              `${(d.document_type ?? "")
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c: string) => c.toUpperCase())}: ${(d.document_status ?? "pending").replace(/\b\w/g, (c: string) => c.toUpperCase())}`
          )
        : ["No documents"],
    subtotal: `$${data.subtotal_amount ?? 0}`,
    deliveryFee: `$${data.delivery_fee_amount ?? 0}`,
    depositPaid: `$${data.deposit_due_amount ?? 0}`,
    balanceDue: `$${data.balance_due_amount ?? 0}`,
    total: `$${data.total_amount ?? 0}`,
    notes: data.notes ?? "",
  };
}