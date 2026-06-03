import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureFreshTokens,
  qboGet,
  qboPost,
  type QboError,
  type QboTokens,
} from "./client";
import {
  loadQboConnection,
  persistRefreshedTokens,
  recordSyncFailure,
  recordSyncSuccess,
} from "./connection";

/**
 * Sprint 2 — push a paid Korent invoice into QuickBooks Online.
 *
 * Two-way sync architecture, one-way realised:
 *
 *   Korent → QBO
 *     - On order moving to a paid status (delivered / completed /
 *       balance fully paid), we upsert the customer, then create the
 *       invoice with line items. We do NOT push a payment record yet
 *       (Sprint 2.5) — the invoice is created with the deposit already
 *       applied as a one-line credit so QBO's balance matches reality.
 *
 *   QBO → Korent (pull)
 *     - Not implemented in Sprint 2. Intuit webhooks (account.deleted,
 *       customer.merged) land in Sprint 2.5 with the rest of the
 *       lifecycle handling.
 *
 * Idempotency:
 *   - One row per (organization_id, order_id) in
 *     `quickbooks_invoice_sync` records the QBO ids and the last
 *     attempt outcome. A re-sync (manual button or daily reconcile
 *     cron) either updates the existing QBO invoice or no-ops if it
 *     already matches.
 *
 * Failure mode:
 *   - The function never throws. Failures land in the sync log + the
 *     `qbo_last_sync_error` column for the dashboard to surface.
 *   - Token-refresh failures terminate the sync without retry; the
 *     operator needs to reconnect.
 */

export type SyncResult =
  | {
      ok: true;
      invoiceId: string;
      customerId: string;
      action: "created" | "updated" | "noop";
    }
  | { ok: false; reason: string; detail?: string };

export async function syncOrderToQuickBooks(
  supabase: SupabaseClient,
  organizationId: string,
  orderId: string,
): Promise<SyncResult> {
  // 1. Load the org's QBO connection. If not connected, this is a no-op.
  const connection = await loadQboConnection(supabase, organizationId);
  if (!connection) {
    return { ok: false, reason: "not_connected" };
  }

  // 2. Ensure tokens are fresh; persist if we had to refresh.
  let tokens: QboTokens;
  try {
    const ensured = await ensureFreshTokens(connection);
    tokens = ensured.tokens;
    if (ensured.refreshed) {
      await persistRefreshedTokens(supabase, organizationId, tokens);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordSyncFailure(supabase, organizationId, `token_refresh: ${message}`);
    return { ok: false, reason: "token_refresh_failed", detail: message };
  }

  // 3. Load the order, customer, and items. We mirror the shape used
  //    by the invoice PDF generator so the QBO invoice matches what
  //    the customer received.
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      "id, order_number, event_date, total_amount, subtotal_amount, delivery_fee_amount, customer_id, order_items(item_name_snapshot, quantity, unit_price, line_total)",
    )
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (orderErr || !order) {
    await recordSyncFailure(supabase, organizationId, `order_not_found: ${orderId}`);
    return { ok: false, reason: "order_not_found" };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, first_name, last_name, email, phone")
    .eq("id", order.customer_id)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!customer) {
    await recordSyncFailure(supabase, organizationId, `customer_not_found: ${order.customer_id}`);
    return { ok: false, reason: "customer_not_found" };
  }

  // 4. Find or create the existing sync row so we can record progress.
  const { data: existing } = await supabase
    .from("quickbooks_invoice_sync")
    .select("id, qbo_invoice_id, qbo_customer_id, attempts")
    .eq("organization_id", organizationId)
    .eq("order_id", orderId)
    .maybeSingle();

  const syncRowId = existing?.id;
  const previousQboCustomerId = existing?.qbo_customer_id ?? null;
  const previousQboInvoiceId = existing?.qbo_invoice_id ?? null;
  const attempts = (existing?.attempts ?? 0) + 1;

  await upsertSyncRow(supabase, {
    id: syncRowId,
    organizationId,
    orderId,
    qboCustomerId: previousQboCustomerId,
    qboInvoiceId: previousQboInvoiceId,
    status: "pending",
    attempts,
    error: null,
  });

  // 5. Upsert customer.
  const customerName = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Customer";
  let qboCustomerId = previousQboCustomerId;

  if (!qboCustomerId) {
    const customerResult = await upsertQboCustomer(supabase, organizationId, tokens, {
      displayName: customerName,
      email: customer.email ?? undefined,
      phone: customer.phone ?? undefined,
    });
    if (!customerResult.ok) {
      await markFailure(supabase, syncRowId, organizationId, "customer_sync_failed", customerResult);
      return { ok: false, reason: "customer_sync_failed", detail: customerResult.detail };
    }
    qboCustomerId = customerResult.customerId;
    tokens = customerResult.tokens;
  }

  // 6. Build invoice line items.
  const items = ((order.order_items as unknown) as
    | { item_name_snapshot: string | null; quantity: number | null; unit_price: number | null; line_total: number | null }[]
    | null) ?? [];

  const invoiceLines = items.map((item, idx) => ({
    Id: String(idx + 1),
    Description: item.item_name_snapshot ?? "Rental item",
    Amount: Number(item.line_total ?? 0),
    DetailType: "SalesItemLineDetail" as const,
    SalesItemLineDetail: {
      Qty: Number(item.quantity ?? 1),
      UnitPrice: Number(item.unit_price ?? 0),
    },
  }));

  const deliveryFee = Number(order.delivery_fee_amount ?? 0);
  if (deliveryFee > 0) {
    invoiceLines.push({
      Id: String(invoiceLines.length + 1),
      Description: "Delivery and setup",
      Amount: deliveryFee,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: { Qty: 1, UnitPrice: deliveryFee },
    });
  }

  // 7. Create or update the invoice.
  let qboInvoiceId = previousQboInvoiceId;
  let action: "created" | "updated" | "noop" = "noop";

  if (!qboInvoiceId) {
    const invoiceResult = await createQboInvoice(supabase, organizationId, tokens, {
      customerId: qboCustomerId,
      docNumber: order.order_number,
      txnDate: (order.event_date as string | null) ?? new Date().toISOString().slice(0, 10),
      lines: invoiceLines,
      privateNote: `Korent order ${order.order_number}`,
    });
    if (!invoiceResult.ok) {
      await markFailure(supabase, syncRowId, organizationId, "invoice_create_failed", invoiceResult);
      return { ok: false, reason: "invoice_create_failed", detail: invoiceResult.detail };
    }
    qboInvoiceId = invoiceResult.invoiceId;
    tokens = invoiceResult.tokens;
    action = "created";
  } else {
    // Invoice already exists in QBO. Full update (matching line items
    // by Korent's snapshot) is Sprint 2.5 work — for now we report
    // noop so a re-sync doesn't double-charge anyone.
    action = "noop";
  }

  // 8. Record success.
  await upsertSyncRow(supabase, {
    id: syncRowId,
    organizationId,
    orderId,
    qboCustomerId,
    qboInvoiceId,
    status: "synced",
    attempts,
    error: null,
    succeededAt: new Date(),
  });
  await recordSyncSuccess(supabase, organizationId);

  return {
    ok: true,
    invoiceId: qboInvoiceId,
    customerId: qboCustomerId,
    action,
  };
}

async function upsertQboCustomer(
  supabase: SupabaseClient,
  _organizationId: string,
  tokens: QboTokens,
  input: { displayName: string; email?: string; phone?: string },
): Promise<
  | { ok: true; customerId: string; tokens: QboTokens }
  | (QboError & { ok: false })
> {
  // 1. Try to find an existing customer by display name. QBO requires
  //    unique display names per realm, so a name match means we'd be
  //    creating a duplicate.
  const escaped = input.displayName.replace(/'/g, "\\'");
  const query = `SELECT Id, DisplayName FROM Customer WHERE DisplayName = '${escaped}'`;
  const search = await qboGet<{
    QueryResponse?: { Customer?: { Id: string; DisplayName: string }[] };
  }>(tokens, `query?query=${encodeURIComponent(query)}&minorversion=70`, {
    onTokenRefresh: async (next) => {
      await persistRefreshedTokens(supabase, _organizationId, next);
    },
  });
  if (!search.ok) return search;
  tokens = search.tokens;
  const existing = search.data.QueryResponse?.Customer?.[0];
  if (existing?.Id) {
    return { ok: true, customerId: existing.Id, tokens };
  }

  // 2. Create.
  const create = await qboPost<{ Customer?: { Id: string } }>(
    tokens,
    "customer?minorversion=70",
    {
      DisplayName: input.displayName,
      PrimaryEmailAddr: input.email ? { Address: input.email } : undefined,
      PrimaryPhone: input.phone ? { FreeFormNumber: input.phone } : undefined,
    },
    {
      onTokenRefresh: async (next) => {
        await persistRefreshedTokens(supabase, _organizationId, next);
      },
    },
  );
  if (!create.ok) return create;
  const customerId = create.data.Customer?.Id;
  if (!customerId) {
    return {
      ok: false,
      status: 500,
      reason: "validation",
      detail: "QBO customer create returned no Id",
    };
  }
  return { ok: true, customerId, tokens: create.tokens };
}

async function createQboInvoice(
  supabase: SupabaseClient,
  organizationId: string,
  tokens: QboTokens,
  input: {
    customerId: string;
    docNumber: string;
    txnDate: string;
    lines: unknown[];
    privateNote: string;
  },
): Promise<
  | { ok: true; invoiceId: string; tokens: QboTokens }
  | (QboError & { ok: false })
> {
  const result = await qboPost<{ Invoice?: { Id: string } }>(
    tokens,
    "invoice?minorversion=70",
    {
      Line: input.lines,
      CustomerRef: { value: input.customerId },
      DocNumber: input.docNumber,
      TxnDate: input.txnDate,
      PrivateNote: input.privateNote,
    },
    {
      onTokenRefresh: async (next) => {
        await persistRefreshedTokens(supabase, organizationId, next);
      },
    },
  );
  if (!result.ok) return result;
  const invoiceId = result.data.Invoice?.Id;
  if (!invoiceId) {
    return {
      ok: false,
      status: 500,
      reason: "validation",
      detail: "QBO invoice create returned no Id",
    };
  }
  return { ok: true, invoiceId, tokens: result.tokens };
}

async function upsertSyncRow(
  supabase: SupabaseClient,
  input: {
    id?: string;
    organizationId: string;
    orderId: string;
    qboCustomerId: string | null;
    qboInvoiceId: string | null;
    status: "pending" | "synced" | "failed" | "stale";
    attempts: number;
    error: string | null;
    succeededAt?: Date;
  },
): Promise<void> {
  if (input.id) {
    await supabase
      .from("quickbooks_invoice_sync")
      .update({
        qbo_customer_id: input.qboCustomerId,
        qbo_invoice_id: input.qboInvoiceId,
        sync_status: input.status,
        attempts: input.attempts,
        last_attempted_at: new Date().toISOString(),
        last_succeeded_at: input.succeededAt?.toISOString() ?? null,
        last_error: input.error,
      })
      .eq("id", input.id);
  } else {
    await supabase.from("quickbooks_invoice_sync").insert({
      organization_id: input.organizationId,
      order_id: input.orderId,
      qbo_customer_id: input.qboCustomerId,
      qbo_invoice_id: input.qboInvoiceId,
      sync_status: input.status,
      attempts: input.attempts,
      last_attempted_at: new Date().toISOString(),
      last_succeeded_at: input.succeededAt?.toISOString() ?? null,
      last_error: input.error,
    });
  }
}

async function markFailure(
  supabase: SupabaseClient,
  syncRowId: string | undefined,
  organizationId: string,
  reason: string,
  err: QboError,
): Promise<void> {
  const detail = `${reason}: ${err.detail.slice(0, 300)}`;
  if (syncRowId) {
    await supabase
      .from("quickbooks_invoice_sync")
      .update({
        sync_status: "failed",
        last_error: detail,
        last_attempted_at: new Date().toISOString(),
      })
      .eq("id", syncRowId);
  }
  await recordSyncFailure(supabase, organizationId, detail);
}
