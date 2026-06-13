import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActiveMemberRole, FINANCIAL_DOC_ROLES } from "@/lib/auth/member-role";
import { generateDocumentPdf } from "@/lib/documents/generate-pdf";
import { getPrimaryVerticalSlug } from "@/lib/verticals/org-verticals";
import { getOrderFinancials } from "@/lib/payments/financials";
import { formatDateInTimeZone } from "@/lib/datetime/event-time";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { documentId } = await params;

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Not available in demo mode" }, { status: 503 });
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let allowed: boolean;
  try {
    ({ allowed } = await enforceRateLimit({
      scope: "api:documents:user",
      actor: ctx.userId,
      limit: 20,
      windowSeconds: 900,
    }));
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429 });
  }

  const supabase = await createSupabaseServerClient();

  // Signed legal docs incl. signer name + IP — restrict to operational roles.
  const role = await getActiveMemberRole(supabase, ctx.organizationId, ctx.userId);
  if (!role || !FINANCIAL_DOC_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: document } = await supabase
    .from("documents")
    .select(`
      id, document_type, document_status, order_id,
      signed_date, signer_name, signer_ip, signature_data_url
    `)
    .eq("id", documentId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Order + items + org + primary vertical in parallel. Resolve the org's
  // primary vertical via the join-table helper — for multi-vertical orgs
  // organizations.business_type can be stale; the helper falls back to it.
  const [{ data: order }, { data: items }, { data: org }, primaryVertical] =
    await Promise.all([
      supabase
        .from("orders")
        .select(`
          order_number, event_date, rental_end_date,
          subtotal_amount, delivery_fee_amount, tax_amount, total_amount,
          customer_id, delivery_address_id
        `)
        .eq("id", document.order_id)
        .eq("organization_id", ctx.organizationId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("order_items")
        .select("item_name_snapshot, quantity, unit_price, line_total")
        .eq("order_id", document.order_id),
      supabase
        .from("organizations")
        .select("name, support_email, phone, event_timezone, settings")
        .eq("id", ctx.organizationId)
        .is("deleted_at", null)
        .maybeSingle(),
      getPrimaryVerticalSlug(),
    ]);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Customer (renter) + their delivery address, scoped to the org.
  const { data: customer } = await supabase
    .from("customers")
    .select("first_name, last_name, email, phone")
    .eq("id", order.customer_id)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  let renterAddressLines: string[] = [];
  if (order.delivery_address_id) {
    const { data: address } = await supabase
      .from("customer_addresses")
      .select("line1, line2, city, state, postal_code")
      .eq("id", order.delivery_address_id)
      .maybeSingle();
    if (address) {
      renterAddressLines = [
        address.line1,
        address.line2,
        [address.city, address.state, address.postal_code].filter(Boolean).join(", "),
      ].filter((l): l is string => Boolean(l && l.trim()));
    }
  }

  const settings = (org?.settings as Record<string, unknown> | null) ?? {};
  const settingStr = (key: string) =>
    typeof settings[key] === "string" ? (settings[key] as string).trim() : "";

  const businessAddressLines = [
    settingStr("business_address_line1"),
    settingStr("business_address_line2"),
    [
      settingStr("business_city"),
      settingStr("business_state"),
      settingStr("business_postal_code"),
    ]
      .filter(Boolean)
      .join(", "),
  ].filter((l) => Boolean(l && l.trim()));

  // Brand accent for the PDF — only when the operator explicitly set a
  // color. The platform default (#1e5dcf) means "never customized"; the
  // document stays pure ink in that case.
  const rawBrandColor =
    (settings.brand_primary_color as string | undefined) ?? null;
  const brandColor =
    rawBrandColor && rawBrandColor.toLowerCase() !== "#1e5dcf" ? rawBrandColor : null;

  const tz = org?.event_timezone ?? "UTC";
  const fmtDate = (d: string) =>
    formatDateInTimeZone(`${d}T12:00:00Z`, tz, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  const rentalPeriod = order.event_date
    ? order.rental_end_date && order.rental_end_date !== order.event_date
      ? `${fmtDate(order.event_date)} – ${fmtDate(order.rental_end_date)}`
      : fmtDate(order.event_date)
    : "TBD";

  const signedDate = document.signed_date
    ? new Date(document.signed_date).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : null;

  // Financials from the payments ledger (never the stale stored balance).
  const financialsRollup = await getOrderFinancials(document.order_id, ctx.organizationId);
  const totalAmount = Number(order.total_amount ?? 0);

  const customerName = customer
    ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
    : "Customer";

  const pdfBytes = generateDocumentPdf({
    documentType: document.document_type as "rental_agreement" | "safety_waiver",
    business: {
      name: org?.name ?? "Rental Co",
      email: org?.support_email ?? "",
      phone: org?.phone ?? "",
      addressLines: businessAddressLines,
      representativeName: settingStr("business_representative_name") || null,
    },
    renter: {
      name: customerName,
      email: customer?.email ?? "",
      phone: customer?.phone ?? "",
      addressLines: renterAddressLines,
    },
    supportEmail: org?.support_email ?? "",
    orderNumber: order.order_number,
    rentalPeriod,
    items: (items ?? []).map((i) => ({
      name: i.item_name_snapshot ?? "Rental item",
      quantity: Number(i.quantity ?? 1),
      unitPrice: Number(i.unit_price ?? 0),
      lineTotal: Number(i.line_total ?? 0),
    })),
    financials: {
      subtotal: Number(order.subtotal_amount ?? 0),
      deliveryFee: Number(order.delivery_fee_amount ?? 0),
      tax: Number(order.tax_amount ?? 0),
      taxLabel: null,
      total: totalAmount,
      depositPaid: financialsRollup?.totalPaid ?? 0,
      balanceDue: financialsRollup?.remainingBalance ?? totalAmount,
    },
    signedDate,
    signerName: document.signer_name ?? null,
    signerIp: document.signer_ip ?? null,
    signatureDataUrl: document.signature_data_url ?? null,
    // Pass the raw primary-vertical slug; getTerms() lands on the generic
    // event-rental block when the slug is unknown (#304).
    businessType: primaryVertical ?? "",
    brandColor,
  });

  const docTitle = document.document_type === "rental_agreement"
    ? "Rental-Agreement"
    : "Safety-Waiver";
  const filename = `${docTitle}-${order.order_number}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
