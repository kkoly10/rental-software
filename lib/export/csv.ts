"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { checkFeatureAccess } from "@/lib/stripe/gate";

function escapeCsvField(value: string): string {
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

export type ExportResult = {
  ok: boolean;
  message: string;
  csv?: string;
  filename?: string;
};

export async function exportOrders(): Promise<ExportResult> {
  const gate = await checkFeatureAccess("csv_export");
  if (!gate.allowed) {
    return { ok: false, message: gate.reason ?? "CSV export requires Growth plan." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Database not configured." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "order_number, order_status, event_date, total_amount, subtotal_amount, delivery_fee_amount, deposit_due_amount, balance_due_amount, created_at, customers(first_name, last_name, email, phone), order_items(item_name_snapshot, unit_price_snapshot, quantity)"
    )
    .eq("organization_id", ctx.organizationId)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error || !data) {
    return { ok: false, message: "Failed to fetch orders." };
  }

  const headers = [
    "Order Number", "Status", "Event Date", "Customer Name", "Customer Email",
    "Customer Phone", "Items", "Subtotal", "Delivery Fee", "Deposit Due",
    "Balance Due", "Total", "Created At",
  ];

  const rows = data.map((o) => {
    const c = (o as Record<string, unknown>).customers as
      | { first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null }
      | null;
    const items = ((o as Record<string, unknown>).order_items as
      | { item_name_snapshot?: string | null; quantity?: number | null }[]
      | null) ?? [];

    return [
      o.order_number ?? "",
      o.order_status ?? "",
      o.event_date ?? "",
      c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : "",
      c?.email ?? "",
      c?.phone ?? "",
      items.map((i) => `${i.item_name_snapshot ?? "Item"} x${i.quantity ?? 1}`).join("; "),
      String(o.subtotal_amount ?? 0),
      String(o.delivery_fee_amount ?? 0),
      String(o.deposit_due_amount ?? 0),
      String(o.balance_due_amount ?? 0),
      String(o.total_amount ?? 0),
      o.created_at ?? "",
    ];
  });

  const csv = toCsv(headers, rows);
  const date = new Date().toISOString().slice(0, 10);
  return { ok: true, message: `Exported ${rows.length} orders.`, csv, filename: `orders-${date}.csv` };
}

export async function exportCustomers(): Promise<ExportResult> {
  const gate = await checkFeatureAccess("csv_export");
  if (!gate.allowed) {
    return { ok: false, message: gate.reason ?? "CSV export requires Growth plan." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Database not configured." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("customers")
    .select("first_name, last_name, email, phone, address_line1, address_line2, city, state, postal_code, created_at")
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error || !data) {
    return { ok: false, message: "Failed to fetch customers." };
  }

  const headers = [
    "First Name", "Last Name", "Email", "Phone",
    "Address", "City", "State", "Zip", "Created At",
  ];

  const rows = data.map((c) => [
    c.first_name ?? "",
    c.last_name ?? "",
    c.email ?? "",
    c.phone ?? "",
    [c.address_line1, c.address_line2].filter(Boolean).join(", "),
    c.city ?? "",
    c.state ?? "",
    c.postal_code ?? "",
    c.created_at ?? "",
  ]);

  const csv = toCsv(headers, rows);
  const date = new Date().toISOString().slice(0, 10);
  return { ok: true, message: `Exported ${rows.length} customers.`, csv, filename: `customers-${date}.csv` };
}

export async function exportPayments(): Promise<ExportResult> {
  const gate = await checkFeatureAccess("csv_export");
  if (!gate.allowed) {
    return { ok: false, message: gate.reason ?? "CSV export requires Growth plan." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Database not configured." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("payments")
    .select(
      "amount, payment_type, payment_method, payment_status, paid_at, notes, orders!inner(organization_id, order_number, customers(first_name, last_name, email))"
    )
    .eq("orders.organization_id", ctx.organizationId)
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(2000);

  if (error || !data) {
    return { ok: false, message: "Failed to fetch payments." };
  }

  const headers = [
    "Order Number", "Customer", "Email", "Amount",
    "Type", "Method", "Status", "Paid At", "Notes",
  ];

  const rows = data.map((p) => {
    const order = (p as Record<string, unknown>).orders as
      | { order_number?: string | null; customers?: { first_name?: string | null; last_name?: string | null; email?: string | null } | null }
      | null;
    const c = order?.customers;
    return [
      order?.order_number ?? "",
      c ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() : "",
      c?.email ?? "",
      String(p.amount ?? 0),
      p.payment_type ?? "",
      p.payment_method ?? "",
      p.payment_status ?? "",
      p.paid_at ?? "",
      p.notes ?? "",
    ];
  });

  const csv = toCsv(headers, rows);
  const date = new Date().toISOString().slice(0, 10);
  return { ok: true, message: `Exported ${rows.length} payments.`, csv, filename: `payments-${date}.csv` };
}
