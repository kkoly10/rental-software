import { notFound } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getOrgFormatting } from "@/lib/i18n/org-formatting";
import { formatMoney } from "@/lib/i18n/format-helpers";
import { getOrderFinancials } from "@/lib/payments/financials";
import { formatTimeInTimeZone } from "@/lib/datetime/event-time";
import { getOrgEventTimezone } from "@/lib/datetime/org-timezone";
import { getMessages } from "@/lib/i18n/server";
import { formatInflatableItemLine } from "@/lib/inflatable/format-item-line";
import type { OrderDetail } from "@/lib/types";

const fallbackOrderDetail: OrderDetail = {
  id: "ord_1001",
  orderNumber: "ORD-1001",
  status: "Confirmed",
  customerId: null,
  customerName: "Ashley Johnson",
  customerEmail: "ashley@example.com",
  customerPhone: "(540) 555-0102",
  eventDate: "May 24, 2026",
  items: ["Castle Bouncer", "Generator Add-on"],
  deliveryLabel: "123 Oak Lane, Stafford, VA 22554",
  documents: ["Rental Agreement: Signed", "Safety Waiver: Pending"],
  documentObjects: [],
  subtotal: "$225",
  deliveryFee: "$20",
  tax: "$0",
  depositPaid: "$75",
  depositPaidAmount: 75,
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
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, order_status, event_date,
      event_start_time, event_end_time, notes,
      subtotal_amount, delivery_fee_amount, tax_amount, total_amount,
      deposit_due_amount, balance_due_amount,
      delivery_surface_type, delivery_gate_code,
      delivery_contact_name, delivery_contact_phone, delivery_setup_notes,
      customer_id,
      customers(id, first_name, last_name, email, phone),
      order_items(item_name_snapshot, line_total, selected_mode, products(anchoring_methods, required_anchor_count)),
      documents(id, document_type, document_status),
      customer_addresses!delivery_address_id(line1, line2, city, state, postal_code)
    `)
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const customer = (data as Record<string, unknown>).customers as {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  } | null;

  const items =
    ((data as Record<string, unknown>).order_items as
      | {
          item_name_snapshot: string;
          line_total: number;
          selected_mode?: string | null;
          products?: {
            anchoring_methods?: string[] | null;
            required_anchor_count?: number | null;
          } | null;
        }[]
      | null) ?? [];

  const docs =
    ((data as Record<string, unknown>).documents as
      | { id: string; document_type: string; document_status: string }[]
      | null) ?? [];

  // many-to-one FK (orders → customer_addresses) — PostgREST embeds a single object, not an array
  const address = (data as Record<string, unknown>).customer_addresses as {
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postal_code: string;
  } | null;

  const status = (data.order_status ?? "inquiry")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  // Compute financials from the payments table — never trust stored balance_due_amount
  const financials = await getOrderFinancials(data.id, ctx.organizationId);
  const totalPaid = financials?.totalPaid ?? 0;
  const remainingBalance = financials?.remainingBalance ?? Number(data.total_amount ?? 0);
  const tz = await getOrgEventTimezone(ctx.organizationId);
  const { currency, locale } = await getOrgFormatting();
  const money = (n: number) => formatMoney(n, currency, locale);
  // Sprint 6.0 — locale-aware mode + anchoring labels for the items list.
  const i18nMessages = await getMessages();
  const inflatableLabels = i18nMessages.forms.editProduct.inflatableSetup;

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
      ? new Date(data.event_date + "T12:00:00Z").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        })
      : "TBD",
    missingEventDate: !data.event_date,
    eventStartTime: data.event_start_time
      ? formatTimeInTimeZone(data.event_start_time, tz)
      : undefined,
    eventEndTime: data.event_end_time
      ? formatTimeInTimeZone(data.event_end_time, tz)
      : undefined,
    items:
      items.length > 0
        ? items.map((i) =>
            formatInflatableItemLine(
              {
                itemName: i.item_name_snapshot ?? "Item",
                selectedMode: i.selected_mode,
                anchoringMethods: i.products?.anchoring_methods ?? null,
                requiredAnchorCount: i.products?.required_anchor_count ?? null,
              },
              inflatableLabels,
              inflatableLabels.bringPrefix,
            ),
          )
        : ["No items added"],
    deliveryLabel: address
      ? [
          address.line2 ? `${address.line1}, ${address.line2}` : address.line1,
          `${address.city}, ${address.state} ${address.postal_code}`,
        ].join(" · ")
      : "No delivery address on file",
    // Raw parts for the add/edit address form — null when the order
    // has no linked address yet (the stranded-at-confirmed case the
    // form exists to fix).
    deliveryAddress: address
      ? {
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postal_code,
        }
      : null,
    deliverySurfaceType: ((data as Record<string, unknown>).delivery_surface_type as string | null) ?? undefined,
    deliveryGateCode: ((data as Record<string, unknown>).delivery_gate_code as string | null) ?? undefined,
    deliveryContactName: ((data as Record<string, unknown>).delivery_contact_name as string | null) ?? undefined,
    deliveryContactPhone: ((data as Record<string, unknown>).delivery_contact_phone as string | null) ?? undefined,
    deliverySetupNotes: ((data as Record<string, unknown>).delivery_setup_notes as string | null) ?? undefined,
    documents:
      docs.length > 0
        ? docs.map(
            (d) =>
              `${(d.document_type ?? "")
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c: string) => c.toUpperCase())}: ${(d.document_status ?? "pending").replace(/\b\w/g, (c: string) => c.toUpperCase())}`
          )
        : ["No documents"],
    documentObjects: docs.map((d) => ({
      id: d.id,
      type: d.document_type ?? "",
      status: d.document_status ?? "pending",
    })),
    subtotal: money(Number(data.subtotal_amount ?? 0)),
    deliveryFee: money(Number(data.delivery_fee_amount ?? 0)),
    tax: money(Number(data.tax_amount ?? 0)),
    depositPaid: money(totalPaid),
    depositPaidAmount: totalPaid,
    customerId: typeof (data as { customer_id?: unknown }).customer_id === "string"
      ? ((data as { customer_id: string }).customer_id)
      : null,
    depositDue: money(Number(data.deposit_due_amount ?? 0)),
    balanceDue: money(remainingBalance),
    total: money(Number(data.total_amount ?? 0)),
    notes: data.notes ?? "",
  };
}
