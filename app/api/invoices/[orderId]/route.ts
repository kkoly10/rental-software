import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { generateInvoicePdf, type InvoiceData } from "@/lib/invoices/generate-pdf";

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

  const supabase = await createSupabaseServerClient();

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
        subtotal_amount, delivery_fee_amount, total_amount,
        deposit_due_amount, balance_due_amount,
        customer_id, delivery_address_id
      `)
      .eq("id", orderId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle(),
    supabase
      .from("order_items")
      .select("item_name_snapshot, quantity, unit_price, line_total")
      .eq("order_id", orderId),
    supabase
      .from("organizations")
      .select("name, support_email, phone")
      .eq("id", ctx.organizationId)
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

  // Fetch customer
  const { data: customer } = await supabase
    .from("customers")
    .select("first_name, last_name, email, phone")
    .eq("id", order.customer_id)
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

  // Calculate deposit paid (total - balance = paid)
  const totalAmount = Number(order.total_amount ?? 0);
  const balanceDue = Number(order.balance_due_amount ?? 0);
  const depositPaid = Number(Math.max(0, totalAmount - balanceDue).toFixed(2));

  const invoiceData: InvoiceData = {
    businessName: org?.name ?? "RentalOS",
    supportEmail: org?.support_email ?? profile?.email ?? "",
    phone: org?.phone ?? profile?.phone ?? "",
    orderNumber: order.order_number,
    invoiceDate: new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    eventDate: order.event_date
      ? new Date(`${order.event_date}T12:00:00`).toLocaleDateString("en-US", {
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
    total: totalAmount,
    depositPaid,
    balanceDue,
  };

  const pdfBytes = generateInvoicePdf(invoiceData);
  const buffer = Buffer.from(pdfBytes);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${order.order_number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
