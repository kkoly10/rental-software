"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { checkFeatureAccess } from "@/lib/stripe/gate";
import type { ExportResult } from "@/lib/export/csv";

function escapeCsvField(value: string): string {
  // Prefix formula-trigger characters to prevent CSV injection in
  // spreadsheet apps (matches the rule used by lib/export/csv.ts).
  if (/^[=+\-@\t\r]/.test(value) || /^\s+[=+\-@]/.test(value)) value = "'" + value;
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsvField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvField).join(","));
  }
  return lines.join("\n");
}

/**
 * Export paid invoices in a QuickBooks-friendly CSV format.
 *
 * The column set follows QuickBooks Online's invoice-import wizard
 * (https://quickbooks.intuit.com/learn-support/en-us/help-article/import-export-data/import-invoices-quickbooks-online/L7uMJ0F8R_US_en_US):
 *
 *   InvoiceNo, Customer, InvoiceDate, DueDate, Item(Product/Service),
 *   ItemDescription, ItemQuantity, ItemRate, ItemAmount, Memo
 *
 * One row per order line item; the invoice header fields repeat per
 * row, which is the format QBO's importer expects. Pre-pending fields
 * with the `Item` prefix matches the QBO Excel template so a bookkeeper
 * can drop this straight in.
 *
 * Scope: this is the Sprint-1 quick-win that removes the immediate "do
 * you sync with QuickBooks?" sales objection. The Intuit-certified two-
 * way sync ships in Sprint 2.
 *
 * Gated to the `quickbooks_export` feature flag (Pro+). The positioning
 * is "Pro tier includes the QuickBooks sync Goodshuffle charges $39/mo
 * add-on for" — see COMPETITIVE_POSITIONING_MASTER_PLAN.md.
 */
export async function exportQuickBooksInvoicesCsv(options?: {
  fromIso?: string | null;
  toIso?: string | null;
}): Promise<ExportResult> {
  const gate = await checkFeatureAccess("quickbooks_export");
  if (!gate.allowed) {
    return {
      ok: false,
      message: gate.reason ?? "QuickBooks export requires the Pro plan.",
    };
  }

  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Database not configured." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("orders")
    .select(
      "id, order_number, event_date, created_at, subtotal_amount, delivery_fee_amount, total_amount, order_status, customers(first_name, last_name, email), order_items(item_name_snapshot, quantity, unit_price, line_total)"
    )
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .in("order_status", [
      "confirmed",
      "scheduled",
      "out_for_delivery",
      "delivered",
      "pickup_pending",
      "completed",
    ])
    .order("created_at", { ascending: false })
    .limit(2000);

  // Date range filters apply to the order's creation date. Bookkeepers
  // typically run quarterly imports filtered by "invoices created in
  // Q3" so this matches their mental model.
  if (options?.fromIso) query = query.gte("created_at", options.fromIso);
  if (options?.toIso) query = query.lte("created_at", options.toIso);

  const { data, error } = await query;
  if (error || !data) {
    return { ok: false, message: "Failed to fetch orders." };
  }

  const headers = [
    "InvoiceNo",
    "Customer",
    "CustomerEmail",
    "InvoiceDate",
    "DueDate",
    "Item(Product/Service)",
    "ItemDescription",
    "ItemQuantity",
    "ItemRate",
    "ItemAmount",
    "Memo",
  ];

  const rows: string[][] = [];

  for (const order of data) {
    const o = order as Record<string, unknown> & {
      id: string;
      order_number?: string | null;
      event_date?: string | null;
      created_at?: string | null;
      subtotal_amount?: number | null;
      delivery_fee_amount?: number | null;
      total_amount?: number | null;
    };
    const customer = o.customers as
      | { first_name?: string | null; last_name?: string | null; email?: string | null }
      | null;
    const items = (o.order_items as
      | {
          item_name_snapshot?: string | null;
          quantity?: number | null;
          unit_price?: number | null;
          line_total?: number | null;
        }[]
      | null) ?? [];

    const customerName = customer
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : "";
    const customerEmail = customer?.email ?? "";
    const invoiceDate = (o.created_at ?? "").slice(0, 10);
    // Due date defaults to the event date (the rental fulfillment
    // moment). Operators using upfront-pay deposits can ignore this
    // column on import.
    const dueDate = o.event_date ?? invoiceDate;
    const memo = o.event_date ? `Event: ${o.event_date}` : "";

    if (items.length === 0) {
      // Order with no line items — emit a single fallback row so
      // bookkeepers still see the order in their import. Use the total
      // as the amount.
      rows.push([
        o.order_number ?? "",
        customerName,
        customerEmail,
        invoiceDate,
        dueDate,
        "Rental",
        "Rental order",
        "1",
        String(o.total_amount ?? 0),
        String(o.total_amount ?? 0),
        memo,
      ]);
      continue;
    }

    for (const item of items) {
      rows.push([
        o.order_number ?? "",
        customerName,
        customerEmail,
        invoiceDate,
        dueDate,
        item.item_name_snapshot ?? "Rental",
        item.item_name_snapshot ?? "Rental item",
        String(item.quantity ?? 1),
        String(item.unit_price ?? 0),
        String(item.line_total ?? 0),
        memo,
      ]);
    }

    // Emit delivery fee as a separate line item if present, since QBO
    // bookkeepers usually map this to a "Delivery" service code in
    // their chart of accounts.
    const deliveryFee = Number(o.delivery_fee_amount ?? 0);
    if (deliveryFee > 0) {
      rows.push([
        o.order_number ?? "",
        customerName,
        customerEmail,
        invoiceDate,
        dueDate,
        "Delivery Fee",
        "Delivery and setup",
        "1",
        String(deliveryFee),
        String(deliveryFee),
        memo,
      ]);
    }
  }

  const csv = toCsv(headers, rows);
  const date = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    message: `Exported ${rows.length} invoice line${rows.length === 1 ? "" : "s"}.`,
    csv,
    filename: `quickbooks-invoices-${date}.csv`,
  };
}
