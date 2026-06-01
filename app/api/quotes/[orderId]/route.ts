import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { generateQuotePdf } from "@/lib/quotes/generate-pdf";
import { getSiteUrl } from "@/lib/site-url";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { safeFilenameToken } from "@/lib/security/header-safe";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const { orderId } = await params;

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
      scope: "api:quotes:user",
      actor: ctx.userId,
      limit: 10,
      windowSeconds: 900,
    }));
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Please wait before trying again." }, { status: 429 });
  }

  const supabase = await createSupabaseServerClient();

  const { data: order } = await supabase
    .from("orders")
    .select(`
      id, order_number, order_status, event_date,
      subtotal_amount, delivery_fee_amount, total_amount, deposit_due_amount,
      customers!inner(first_name, last_name, email, phone),
      order_items(item_name_snapshot, quantity, unit_price, line_total),
      customer_addresses!delivery_address_id(line1, city, state, postal_code)
    `)
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("name, support_email, phone")
    .eq("id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  const customer = order.customers as unknown as {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };

  const address = order.customer_addresses as unknown as {
    line1: string;
    city: string;
    state: string;
    postal_code: string;
  } | null;

  const orderItems = (order.order_items as unknown as {
    item_name_snapshot: string;
    quantity: number;
    unit_price: number;
    line_total: number;
  }[]) ?? [];

  const customerName = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
  const deliveryAddress = address
    ? `${address.line1}, ${address.city}, ${address.state} ${address.postal_code}`
    : "";

  const eventDate = order.event_date
    ? new Date(order.event_date + "T00:00:00").toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";

  // Use the static lookup URL — never issue a new portal token here, as that
  // would overwrite the hash stored during sendQuote() and break the link in
  // the customer's email. Customers can always look up their order by number + email.
  const siteUrl = await getSiteUrl();
  const portalUrl = `${siteUrl}/order-status`;

  const pdfBytes = generateQuotePdf({
    businessName: org?.name ?? "Rental Co",
    supportEmail: org?.support_email ?? "",
    phone: org?.phone ?? "",
    orderNumber: order.order_number,
    quoteDate: new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    eventDate,
    customerName,
    customerEmail: customer.email ?? "",
    customerPhone: customer.phone ?? "",
    deliveryAddress,
    items: orderItems.map((i) => ({
      name: i.item_name_snapshot ?? "Item",
      quantity: i.quantity ?? 1,
      unitPrice: i.unit_price ?? 0,
      lineTotal: i.line_total ?? 0,
    })),
    subtotal: Number(order.subtotal_amount ?? 0),
    deliveryFee: Number(order.delivery_fee_amount ?? 0),
    total: Number(order.total_amount ?? 0),
    depositRequired: Number(order.deposit_due_amount ?? 0),
    portalUrl,
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Quote-${safeFilenameToken(order.order_number)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
