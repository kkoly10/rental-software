"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { checkFeatureAccess } from "@/lib/stripe/gate";
import { getOrderFinancialsBatch } from "@/lib/payments/financials";

function escapeCsvField(value: string): string {
  // Prefix formula-trigger characters to prevent CSV injection in spreadsheet apps.
  // Spreadsheets strip leading whitespace before evaluating, so also catch a
  // trigger char that follows leading spaces (e.g. " =cmd").
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
      "id, order_number, order_status, event_date, total_amount, subtotal_amount, delivery_fee_amount, deposit_due_amount, balance_due_amount, created_at, customers(first_name, last_name, email, phone), order_items(item_name_snapshot, unit_price, quantity)"
    )
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error || !data) {
    return { ok: false, message: "Failed to fetch orders." };
  }

  // Compute the real balance from payments for each order (the source of
  // truth). One bulk call instead of N per-order calls — previously this
  // ran 2*N round-trips in batches of 50, so 2000 orders = 80 RPC
  // round-trips taking 10+ seconds. Now it's 2 round-trips total.
  const financialsByOrder = await getOrderFinancialsBatch(
    data.map((o) => o.id),
    ctx.organizationId
  );

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

    const computedBalance =
      financialsByOrder.get(o.id)?.remainingBalance ?? Number(o.total_amount ?? 0);

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
      String(computedBalance),
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
    .select("first_name, last_name, email, phone, notes, created_at")
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error || !data) {
    return { ok: false, message: "Failed to fetch customers." };
  }

  const headers = [
    "First Name", "Last Name", "Email", "Phone", "Notes", "Created At",
  ];

  const rows = data.map((c) => [
    c.first_name ?? "",
    c.last_name ?? "",
    c.email ?? "",
    c.phone ?? "",
    c.notes ?? "",
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
      "amount, payment_type, payment_method, payment_status, paid_at, reference_note, orders!inner(organization_id, order_number, customers(first_name, last_name, email))"
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
      p.reference_note ?? "",
    ];
  });

  const csv = toCsv(headers, rows);
  const date = new Date().toISOString().slice(0, 10);
  return { ok: true, message: `Exported ${rows.length} payments.`, csv, filename: `payments-${date}.csv` };
}

/**
 * Export `app_event_logs` for the operator's org as CSV, scoped to a
 * date range. Owner / admin only — the log includes role changes,
 * payment recordings, billing-portal entries and tracking-link
 * accesses, all of which are operator-internal.
 *
 * The metadata column is JSON; we emit it stringified so spreadsheets
 * can still load the file without crashing on nested objects.
 */
export async function exportAuditLog(options?: {
  fromIso?: string | null;
  toIso?: string | null;
}): Promise<ExportResult> {
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

  // Authorization: only owner / admin can pull the audit log. Other
  // roles seeing this CSV would expose role-change activity, billing
  // portal entries, and tracking lookups they aren't entitled to.
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (membership?.role !== "owner" && membership?.role !== "admin") {
    return { ok: false, message: "Only owners and admins can export the audit log." };
  }

  let query = supabase
    .from("app_event_logs")
    .select("created_at, source, action, status, route, user_id, metadata")
    .eq("organization_id", ctx.organizationId)
    .order("created_at", { ascending: false })
    .limit(10000);

  if (options?.fromIso) query = query.gte("created_at", options.fromIso);
  if (options?.toIso) query = query.lte("created_at", options.toIso);

  const { data, error } = await query;
  if (error || !data) {
    return { ok: false, message: "Failed to fetch audit log." };
  }

  const headers = [
    "Timestamp",
    "Source",
    "Action",
    "Status",
    "Route",
    "User ID",
    "Metadata (JSON)",
  ];

  const rows = data.map((r) => [
    r.created_at ?? "",
    r.source ?? "",
    r.action ?? "",
    r.status ?? "",
    r.route ?? "",
    r.user_id ?? "",
    r.metadata != null ? JSON.stringify(r.metadata) : "",
  ]);

  const csv = toCsv(headers, rows);
  const date = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    message: `Exported ${rows.length} audit-log entries.`,
    csv,
    filename: `audit-log-${date}.csv`,
  };
}
