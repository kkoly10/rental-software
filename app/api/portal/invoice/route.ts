import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { hashPortalAccessToken, isPortalTokenExpired } from "@/lib/portal/access-token";
import { getOrderFinancialsAdmin } from "@/lib/payments/financials";
import { generateInvoicePdf, type InvoiceData } from "@/lib/invoices/generate-pdf";
import { getOrgPrimaryVerticalSlug } from "@/lib/verticals/org-verticals";
import { isGeneralVertical } from "@/lib/verticals/customer-language";
import { fetchLogoDataUrl } from "@/lib/pdf/logo";
import { safeFilenameToken } from "@/lib/security/header-safe";
import { formatDateInTimeZone } from "@/lib/datetime/event-time";

export const dynamic = "force-dynamic";

/**
 * Customer-facing invoice PDF, authorized by the order's portal access
 * token (the same credential the order-status page already holds — both
 * the magic-link and order#/email lookups produce one).
 *
 * This deliberately reuses the SAME professional generator as the
 * operator route (lib/invoices/generate-pdf) so customers get a branded,
 * itemized, tax-aware invoice — not the prior hand-rolled, platform-blue,
 * names-only PDF. The customer portal is anonymous, so reads use the
 * admin client; org isolation is enforced by resolving orgId from the
 * host and filtering every query by it (mirrors lib/portal/lookup).
 */
export async function GET(request: NextRequest) {
  if (!hasSupabaseEnv() || !hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const token = (request.nextUrl.searchParams.get("token") ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  // Rate limit per anonymous client (IP/cookie-derived) — the token is a
  // bearer credential, so cap brute-force/abuse like the portal lookup.
  try {
    const clientKey = await getActionClientKey();
    const { allowed } = await enforceRateLimit({
      scope: "api:portal-invoice",
      actor: clientKey,
      limit: 20,
      windowSeconds: 900,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  const orgId = await getPublicOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Service not available." }, { status: 404 });
  }

  const supabase = createSupabaseAdminClient();
  const tokenHash = hashPortalAccessToken(token);

  const { data: order } = await supabase
    .from("orders")
    .select(`
      id, order_number, event_date, order_status,
      subtotal_amount, delivery_fee_amount, tax_amount, total_amount,
      deposit_due_amount, balance_due_amount,
      customer_id, delivery_address_id, portal_access_token_created_at
    `)
    .eq("organization_id", orgId)
    .eq("portal_access_token_hash", tokenHash)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Invalid or expired link." }, { status: 404 });
  }
  if (isPortalTokenExpired(order.portal_access_token_created_at)) {
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }

  const [{ data: items }, { data: org }, { data: customer }] = await Promise.all([
    supabase
      .from("order_items")
      .select("item_name_snapshot, quantity, unit_price, line_total")
      .eq("order_id", order.id),
    supabase
      .from("organizations")
      .select("name, support_email, phone, event_timezone, settings")
      .eq("id", orgId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("customers")
      .select("first_name, last_name, email, phone")
      .eq("id", order.customer_id)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  let deliveryLabel = "";
  if (order.delivery_address_id) {
    const { data: address } = await supabase
      .from("customer_addresses")
      .select("line1, city, state, postal_code")
      .eq("id", order.delivery_address_id)
      .maybeSingle();
    if (address) {
      deliveryLabel = [address.line1, address.city, address.state, address.postal_code]
        .filter(Boolean)
        .join(", ");
    }
  }

  // Admin variant: the customer portal is anonymous, so the anon-client
  // financials helper can't read the payments table under RLS — that
  // would silently show full balance due even after a deposit was paid.
  const financials = await getOrderFinancialsAdmin(supabase, order.id);
  const totalAmount = Number(order.total_amount ?? 0);
  const depositPaid = financials?.totalPaid ?? 0;
  const balanceDue = financials?.remainingBalance ?? totalAmount;
  const timezone = org?.event_timezone ?? "UTC";
  const general = isGeneralVertical(await getOrgPrimaryVerticalSlug(supabase, orgId));
  const logoDataUrl = await fetchLogoDataUrl(
    ((org?.settings as Record<string, unknown> | null)?.brand_logo_url as string | undefined) ?? null,
  );

  const invoiceData: InvoiceData = {
    businessName: org?.name ?? "Rental Company",
    supportEmail: org?.support_email ?? "",
    phone: org?.phone ?? "",
    orderNumber: order.order_number,
    dateLabel: general ? "Rental date" : "Event date",
    invoiceDate: formatDateInTimeZone(new Date(), timezone, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    eventDate: order.event_date
      ? formatDateInTimeZone(`${order.event_date}T12:00:00Z`, timezone, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "TBD",
    customerName: customer
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || "Customer"
      : "Customer",
    customerEmail: customer?.email ?? "",
    customerPhone: customer?.phone ?? "",
    deliveryAddress: deliveryLabel,
    items: (items ?? []).map((item) => ({
      name: item.item_name_snapshot ?? "Rental item",
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unit_price ?? 0),
      lineTotal: Number(item.line_total ?? 0),
    })),
    subtotal: Number(order.subtotal_amount ?? 0),
    deliveryFee: Number(order.delivery_fee_amount ?? 0),
    tax: Number(order.tax_amount ?? 0),
    taxLabel: null,
    total: totalAmount,
    depositPaid,
    balanceDue,
    // Brand accent only when the operator explicitly set one; the
    // platform default (#1e5dcf) means "never customized" → pure ink.
    brandColor: (() => {
      const raw =
        ((org?.settings as Record<string, unknown> | null)?.brand_primary_color as
          | string
          | undefined) ?? null;
      return raw && raw.toLowerCase() !== "#1e5dcf" ? raw : null;
    })(),
    logoDataUrl,
  };

  const pdfBytes = generateInvoicePdf(invoiceData);
  const buffer = Buffer.from(pdfBytes);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${safeFilenameToken(order.order_number)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
