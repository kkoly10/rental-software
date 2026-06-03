import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureFreshTokens,
  xeroGet,
  xeroPost,
  type XeroError,
  type XeroTokens,
} from "./client";
import {
  loadXeroConnection,
  persistRefreshedTokens,
  recordSyncFailure,
  recordSyncSuccess,
} from "./connection";

/**
 * Push a paid Korent order into Xero (Sprint 3.5).
 *
 * Mirrors the QBO sync exactly with three vocabulary swaps:
 *
 *   - QBO Customer  → Xero Contact (looked up by Name)
 *   - QBO Invoice   → Xero Invoice (Type: ACCREC = "accounts receivable")
 *   - QBO Item      → Xero LineItem with Description + Quantity + UnitAmount
 *
 * Xero invoice payload requires a Status:
 *   - DRAFT       — saved but not sent
 *   - AUTHORISED  — ready to be sent / paid (what we use)
 *   - SUBMITTED   — manager approval pending
 *   - PAID        — fully reconciled
 *
 * We default to AUTHORISED because by the time Korent fires the sync
 * (on `delivered`), the rental has happened — the invoice IS ready.
 */
export type XeroSyncResult =
  | {
      ok: true;
      invoiceId: string;
      contactId: string;
      action: "created" | "noop";
    }
  | { ok: false; reason: string; detail?: string };

export async function syncOrderToXero(
  supabase: SupabaseClient,
  organizationId: string,
  orderId: string,
): Promise<XeroSyncResult> {
  const connection = await loadXeroConnection(supabase, organizationId);
  if (!connection) return { ok: false, reason: "not_connected" };

  let tokens: XeroTokens;
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

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, event_date, total_amount, subtotal_amount, delivery_fee_amount, customer_id, order_items(item_name_snapshot, quantity, unit_price, line_total)",
    )
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!order) {
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

  const { data: existing } = await supabase
    .from("xero_invoice_sync")
    .select("id, xero_invoice_id, xero_contact_id, attempts")
    .eq("organization_id", organizationId)
    .eq("order_id", orderId)
    .maybeSingle();

  const syncRowId = existing?.id;
  const attempts = (existing?.attempts ?? 0) + 1;
  const previousContactId = existing?.xero_contact_id ?? null;
  const previousInvoiceId = existing?.xero_invoice_id ?? null;

  await upsertSyncRow(supabase, {
    id: syncRowId,
    organizationId,
    orderId,
    xeroContactId: previousContactId,
    xeroInvoiceId: previousInvoiceId,
    status: "pending",
    attempts,
    error: null,
  });

  const contactName =
    `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Customer";

  let xeroContactId = previousContactId;
  if (!xeroContactId) {
    const contactResult = await upsertXeroContact(supabase, organizationId, tokens, {
      name: contactName,
      email: customer.email ?? undefined,
      phone: customer.phone ?? undefined,
    });
    if (!contactResult.ok) {
      await markFailure(supabase, syncRowId, organizationId, "contact_sync_failed", contactResult);
      return { ok: false, reason: "contact_sync_failed", detail: contactResult.detail };
    }
    xeroContactId = contactResult.contactId;
    tokens = contactResult.tokens;
  }

  let xeroInvoiceId = previousInvoiceId;
  let action: "created" | "noop" = "noop";

  if (!xeroInvoiceId) {
    const items = ((order.order_items as unknown) as
      | { item_name_snapshot: string | null; quantity: number | null; unit_price: number | null; line_total: number | null }[]
      | null) ?? [];

    const lineItems = items.map((item) => ({
      Description: item.item_name_snapshot ?? "Rental item",
      Quantity: Number(item.quantity ?? 1),
      UnitAmount: Number(item.unit_price ?? 0),
      LineAmount: Number(item.line_total ?? 0),
    }));
    const deliveryFee = Number(order.delivery_fee_amount ?? 0);
    if (deliveryFee > 0) {
      lineItems.push({
        Description: "Delivery and setup",
        Quantity: 1,
        UnitAmount: deliveryFee,
        LineAmount: deliveryFee,
      });
    }

    const invoiceResult = await createXeroInvoice(supabase, organizationId, tokens, {
      contactId: xeroContactId,
      invoiceNumber: order.order_number,
      date: (order.event_date as string | null) ?? new Date().toISOString().slice(0, 10),
      dueDate: (order.event_date as string | null) ?? new Date().toISOString().slice(0, 10),
      lineItems,
      reference: `Korent order ${order.order_number}`,
    });
    if (!invoiceResult.ok) {
      await markFailure(supabase, syncRowId, organizationId, "invoice_create_failed", invoiceResult);
      return { ok: false, reason: "invoice_create_failed", detail: invoiceResult.detail };
    }
    xeroInvoiceId = invoiceResult.invoiceId;
    tokens = invoiceResult.tokens;
    action = "created";
  }

  await upsertSyncRow(supabase, {
    id: syncRowId,
    organizationId,
    orderId,
    xeroContactId,
    xeroInvoiceId,
    status: "synced",
    attempts,
    error: null,
    succeededAt: new Date(),
  });
  await recordSyncSuccess(supabase, organizationId);

  return {
    ok: true,
    invoiceId: xeroInvoiceId,
    contactId: xeroContactId,
    action,
  };
}

async function upsertXeroContact(
  supabase: SupabaseClient,
  organizationId: string,
  tokens: XeroTokens,
  input: { name: string; email?: string; phone?: string },
): Promise<
  | { ok: true; contactId: string; tokens: XeroTokens }
  | (XeroError & { ok: false })
> {
  // Look up by name. Xero's query syntax: ?where=Name=="..."
  const escaped = input.name.replace(/"/g, '\\"');
  const search = await xeroGet<{ Contacts?: { ContactID: string }[] }>(
    tokens,
    `Contacts?where=${encodeURIComponent(`Name=="${escaped}"`)}`,
    {
      onTokenRefresh: async (next) => {
        await persistRefreshedTokens(supabase, organizationId, next);
      },
    },
  );
  if (!search.ok) return search;
  tokens = search.tokens;
  const existing = search.data.Contacts?.[0];
  if (existing?.ContactID) {
    return { ok: true, contactId: existing.ContactID, tokens };
  }

  const create = await xeroPost<{ Contacts?: { ContactID: string }[] }>(
    tokens,
    "Contacts",
    {
      Contacts: [
        {
          Name: input.name,
          EmailAddress: input.email,
          Phones: input.phone
            ? [{ PhoneType: "DEFAULT", PhoneNumber: input.phone }]
            : undefined,
        },
      ],
    },
    {
      onTokenRefresh: async (next) => {
        await persistRefreshedTokens(supabase, organizationId, next);
      },
    },
  );
  if (!create.ok) return create;
  const contactId = create.data.Contacts?.[0]?.ContactID;
  if (!contactId) {
    return {
      ok: false,
      status: 500,
      reason: "validation",
      detail: "Xero contact create returned no ContactID",
    };
  }
  return { ok: true, contactId, tokens: create.tokens };
}

async function createXeroInvoice(
  supabase: SupabaseClient,
  organizationId: string,
  tokens: XeroTokens,
  input: {
    contactId: string;
    invoiceNumber: string;
    date: string;
    dueDate: string;
    lineItems: { Description: string; Quantity: number; UnitAmount: number; LineAmount: number }[];
    reference: string;
  },
): Promise<
  | { ok: true; invoiceId: string; tokens: XeroTokens }
  | (XeroError & { ok: false })
> {
  const result = await xeroPost<{ Invoices?: { InvoiceID: string }[] }>(
    tokens,
    "Invoices",
    {
      Invoices: [
        {
          Type: "ACCREC",
          Contact: { ContactID: input.contactId },
          InvoiceNumber: input.invoiceNumber,
          Reference: input.reference,
          Date: input.date,
          DueDate: input.dueDate,
          LineAmountTypes: "Exclusive",
          LineItems: input.lineItems,
          Status: "AUTHORISED",
        },
      ],
    },
    {
      onTokenRefresh: async (next) => {
        await persistRefreshedTokens(supabase, organizationId, next);
      },
    },
  );
  if (!result.ok) return result;
  const invoiceId = result.data.Invoices?.[0]?.InvoiceID;
  if (!invoiceId) {
    return {
      ok: false,
      status: 500,
      reason: "validation",
      detail: "Xero invoice create returned no InvoiceID",
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
    xeroContactId: string | null;
    xeroInvoiceId: string | null;
    status: "pending" | "synced" | "failed" | "stale";
    attempts: number;
    error: string | null;
    succeededAt?: Date;
  },
): Promise<void> {
  if (input.id) {
    await supabase
      .from("xero_invoice_sync")
      .update({
        xero_contact_id: input.xeroContactId,
        xero_invoice_id: input.xeroInvoiceId,
        sync_status: input.status,
        attempts: input.attempts,
        last_attempted_at: new Date().toISOString(),
        last_succeeded_at: input.succeededAt?.toISOString() ?? null,
        last_error: input.error,
      })
      .eq("id", input.id);
  } else {
    await supabase.from("xero_invoice_sync").insert({
      organization_id: input.organizationId,
      order_id: input.orderId,
      xero_contact_id: input.xeroContactId,
      xero_invoice_id: input.xeroInvoiceId,
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
  err: XeroError,
): Promise<void> {
  const detail = `${reason}: ${err.detail.slice(0, 300)}`;
  if (syncRowId) {
    await supabase
      .from("xero_invoice_sync")
      .update({
        sync_status: "failed",
        last_error: detail,
        last_attempted_at: new Date().toISOString(),
      })
      .eq("id", syncRowId);
  }
  await recordSyncFailure(supabase, organizationId, detail);
}
