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
import { blockDemoWrites } from "@/lib/demo/guard";
import { createOrderNumber } from "@/lib/orders/order-number";
import { logAppError, logAppEvent } from "@/lib/observability/server";

export type QuoteRequestState = {
  ok: boolean;
  message: string;
  orderNumber?: string;
};

/**
 * PR-3d — customer-initiated quote request.
 *
 * Tents, dance-floors, multi-component event rentals don't fit
 * direct-to-checkout: the operator needs to confirm scope, pricing,
 * permits, etc. before quoting. This action sits as a second CTA on
 * the PDP (gated by theme_settings.cta_secondary='request_quote')
 * and creates an `inquiry` order — the same shape an operator-
 * created inquiry takes, so the existing dashboard quote-send flow
 * picks it up without modification.
 *
 * Rate-limited per IP + per email to prevent spam: 3/email/15min
 * and 8/IP/15min (more permissive than checkout because the cost is
 * an operator notification, not a Stripe round-trip).
 *
 * The order is created with order_status='inquiry' and no payments;
 * the operator's quote-send flow transitions it to 'quote_sent' →
 * 'awaiting_deposit' once accepted.
 */
export async function submitQuoteRequest(
  _prev: QuoteRequestState,
  formData: FormData
): Promise<QuoteRequestState> {
  const productSlug = String(formData.get("product_slug") ?? "").trim();
  const firstName = String(formData.get("first_name") ?? "").trim();
  const lastName = String(formData.get("last_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "").trim() || null;
  const zip = String(formData.get("zip") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000);

  if (!firstName || !lastName || !email) {
    return { ok: false, message: "Name and email are required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: quote request would be submitted." };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) return { ok: false, message: "Service not available." };

  const demoCheck = await blockDemoWrites(orgId);
  if (demoCheck.blocked) return { ok: false, message: demoCheck.message };

  try {
    const clientKey = await getActionClientKey();
    const [ipLimit, emailLimit] = await Promise.all([
      enforceRateLimit({
        scope: "quote_request:ip",
        actor: `${orgId}:${clientKey}`,
        limit: 8,
        windowSeconds: 900,
        strict: true,
      }),
      enforceRateLimit({
        scope: "quote_request:email",
        actor: `${orgId}:${email}`,
        limit: 3,
        windowSeconds: 900,
        strict: true,
      }),
    ]);
    if (!ipLimit.allowed || !emailLimit.allowed) {
      return { ok: false, message: "Too many quote requests. Please wait a few minutes." };
    }
  } catch {
    return { ok: false, message: "Unable to process your request right now." };
  }

  const supabase = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();

  // Resolve the product (just to capture the rental line snapshot and
  // surface "We do not currently offer this product" before we create
  // a customer record they'd then have to clean up).
  let productId: string | null = null;
  let productName: string | null = null;
  if (productSlug) {
    const { data: product } = await supabase
      .from("products")
      .select("id, name")
      .eq("slug", productSlug)
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .eq("visibility", "public")
      .is("deleted_at", null)
      .maybeSingle();
    productId = product?.id ?? null;
    productName = product?.name ?? null;
  }

  // Reuse a customer row keyed by email — case-insensitive match
  // mirrors the checkout-action behavior, so a returning quote-only
  // lead lands on the operator's existing CRM record.
  let customerId: string | null = null;
  const { data: existing } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone")
    .eq("organization_id", orgId)
    .ilike("email", email)
    .is("deleted_at", null)
    .maybeSingle();
  if (existing) {
    customerId = existing.id;
    const patch: Record<string, unknown> = {};
    if (firstName && !existing.first_name) patch.first_name = firstName;
    if (lastName && !existing.last_name) patch.last_name = lastName;
    if (phone && !existing.phone) patch.phone = phone;
    if (Object.keys(patch).length > 0) {
      await supabase.from("customers").update(patch).eq("id", customerId).eq("organization_id", orgId);
    }
  } else {
    const { data: created, error: custErr } = await supabase
      .from("customers")
      .insert({
        organization_id: orgId,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
      })
      .select("id")
      .single();
    if (custErr || !created) {
      await logAppError({
        organizationId: orgId,
        source: "quote_request.customer_create",
        message: "Customer insert failed during quote request",
        context: { email, reason: custErr?.message },
      });
      return { ok: false, message: "We couldn't save your contact details. Please try again." };
    }
    customerId = created.id;
  }

  const orderNumber = createOrderNumber();
  const composedNotes = [
    productName ? `Quote request: ${productName}` : "Quote request",
    eventDate ? `Event date: ${eventDate}` : null,
    zip ? `Delivery ZIP: ${zip}` : null,
    notes ? `Notes: ${notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      organization_id: orgId,
      customer_id: customerId,
      order_number: orderNumber,
      order_status: "inquiry",
      event_date: eventDate,
      subtotal_amount: 0,
      delivery_fee_amount: 0,
      tax_amount: 0,
      total_amount: 0,
      deposit_due_amount: 0,
      balance_due_amount: 0,
      fulfillment_type: "delivery",
      source_channel: "website_quote",
      notes: composedNotes,
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    await logAppError({
      organizationId: orgId,
      source: "quote_request.order_create",
      message: "Inquiry order insert failed",
      context: { email, reason: orderErr?.message },
    });
    return { ok: false, message: "We couldn't submit your request. Please try again." };
  }

  if (productId) {
    await supabase.from("order_items").insert({
      order_id: order.id,
      product_id: productId,
      line_type: "rental",
      quantity: 1,
      unit_price: 0,
      line_total: 0,
      item_name_snapshot: productName,
    });
  }

  await logAppEvent({
    organizationId: orgId,
    source: "quote_request",
    action: "inquiry_created",
    status: "info",
    metadata: { orderId: order.id, orderNumber: order.order_number, productSlug },
  });

  // Operator notification — reuse the existing inquiry alert email
  // path the dashboard already wires for operator-created inquiries.
  try {
    const { triggerOperatorActivityAlertEmail } = await import("@/lib/email/triggers");
    await triggerOperatorActivityAlertEmail({
      organizationId: orgId,
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: `${firstName} ${lastName}`.trim(),
      event: "quote_requested",
    });
  } catch (err) {
    // Non-fatal — the inquiry row is the source of truth; the email
    // is a nudge.
    await logAppError({
      organizationId: orgId,
      source: "quote_request.email",
      message: "Operator quote-request notification failed",
      context: { orderId: order.id, reason: err instanceof Error ? err.message : String(err) },
    });
  }

  return {
    ok: true,
    message:
      "Thanks — we've received your request. The operator will review your details and send a quote shortly.",
    orderNumber: order.order_number,
  };
}
