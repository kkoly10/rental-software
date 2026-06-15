import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActiveMemberRole, FINANCIAL_DOC_ROLES } from "@/lib/auth/member-role";
import { getOrderFinancials } from "@/lib/payments/financials";
import { generateInvoicePdf, type InvoiceData } from "@/lib/invoices/generate-pdf";
import { getOrgPrimaryVerticalSlug } from "@/lib/verticals/org-verticals";
import { isGeneralVertical } from "@/lib/verticals/customer-language";
import { fetchLogoDataUrl } from "@/lib/pdf/logo";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { safeFilenameToken } from "@/lib/security/header-safe";
import { formatDateInTimeZone } from "@/lib/datetime/event-time";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Rate limiting: 10 per 15 min per user
  let allowed: boolean;
  try {
    ({ allowed } = await enforceRateLimit({
      scope: "api:invoices:user",
      actor: ctx.userId,
      limit: 10,
      windowSeconds: 900,
    }));
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a few minutes before trying again." },
      { status: 429 }
    );
  }

  const supabase = await createSupabaseServerClient();

  // Financials + customer PII — restrict to operational roles (crew/viewer out).
  const role = await getActiveMemberRole(supabase, ctx.organizationId, ctx.userId);
  if (!role || !FINANCIAL_DOC_ROLES.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch order with customer, items, and org details in parallel
  const [
    { data: order },
    { data: items },
    { data: org },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        id, order_number, event_date, order_status,
        subtotal_amount, delivery_fee_amount, tax_amount, total_amount,
        deposit_due_amount, balance_due_amount,
        customer_id, delivery_address_id
      `)
      .eq("id", orderId)
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("item_name_snapshot, quantity, unit_price, line_total")
      .eq("order_id", orderId),
    supabase
      .from("organizations")
      .select("name, support_email, phone, event_timezone, settings")
      .eq("id", ctx.organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("email, phone")
      .eq("id", ctx.userId)
      .maybeSingle(),
  ]);

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  // Fetch customer — scope to org and exclude soft-deleted records
  const { data: customer } = await supabase
    .from("customers")
    .select("first_name, last_name, email, phone")
    .eq("id", order.customer_id)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  // Fetch delivery address
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

  // Compute financials from payments table — never trust stored balance_due_amount
  const financials = await getOrderFinancials(orderId, ctx.organizationId);
  const totalAmount = Number(order.total_amount ?? 0);
  const depositPaid = financials?.totalPaid ?? 0;
  const balanceDue = financials?.remainingBalance ?? totalAmount;

  const general = isGeneralVertical(await getOrgPrimaryVerticalSlug(supabase, ctx.organizationId));

  const logoDataUrl = await fetchLogoDataUrl(
    ((org?.settings as Record<string, unknown> | null)?.brand_logo_url as string | undefined) ?? null,
  );

  const invoiceData: InvoiceData = {
    businessName: org?.name ?? "Rental Company",
    supportEmail: org?.support_email ?? profile?.email ?? "",
    phone: org?.phone ?? profile?.phone ?? "",
    orderNumber: order.order_number,
    dateLabel: general ? "Rental date" : "Event date",
    invoiceDate: formatDateInTimeZone(new Date(), org?.event_timezone ?? "UTC", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    eventDate: order.event_date
      ? formatDateInTimeZone(`${order.event_date}T12:00:00Z`, org?.event_timezone ?? "UTC", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : "TBD",
    customerName: customer
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
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
    // Brand accent — only when the operator explicitly set a color. The
    // platform default (#1e5dcf) means "never customized"; the invoice
    // stays pure ink in that case.
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
