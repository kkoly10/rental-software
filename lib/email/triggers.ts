import { sendEmail } from "./send";
import {
  orderConfirmationEmail,
  newOrderAlertEmail,
  paymentReceivedEmail,
  refundProcessedEmail,
  orderStatusUpdateEmail,
  documentsReadyEmail,
} from "./templates";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

type OrgBranding = {
  businessName: string;
  supportEmail: string;
  siteUrl: string;
};

async function getOrgBranding(
  organizationId: string
): Promise<OrgBranding> {
  // Dynamic import to avoid circular dependencies
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("name, support_email")
    .eq("id", organizationId)
    .maybeSingle();

  return {
    businessName: org?.name ?? "Korent",
    supportEmail: org?.support_email ?? "support@korent.io",
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  };
}

// ─── Order created (from website checkout) ──────────────────────────────────

export async function triggerOrderConfirmationEmail(params: {
  organizationId: string;
  customerFirstName: string;
  customerEmail: string;
  orderNumber: string;
  productName: string;
  eventDate: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  depositDue: number;
}) {
  const branding = await getOrgBranding(params.organizationId);

  // Email to customer
  await sendEmail({
    to: params.customerEmail,
    subject: `Booking #${params.orderNumber} received — ${branding.businessName}`,
    html: orderConfirmationEmail({
      businessName: branding.businessName,
      customerFirstName: params.customerFirstName,
      orderNumber: params.orderNumber,
      productName: params.productName,
      eventDate: formatDate(params.eventDate),
      subtotal: formatMoney(params.subtotal),
      deliveryFee: formatMoney(params.deliveryFee),
      total: formatMoney(params.total),
      depositDue: formatMoney(params.depositDue),
      supportEmail: branding.supportEmail,
      siteUrl: branding.siteUrl,
    }),
    replyTo: branding.supportEmail,
    organizationId: params.organizationId,
  });

  // Alert to operator
  await sendEmail({
    to: branding.supportEmail,
    subject: `New order #${params.orderNumber} from website`,
    html: newOrderAlertEmail({
      businessName: branding.businessName,
      customerName: params.customerFirstName,
      customerEmail: params.customerEmail,
      orderNumber: params.orderNumber,
      productName: params.productName,
      eventDate: formatDate(params.eventDate),
      total: formatMoney(params.total),
      source: "website",
      dashboardUrl: `${branding.siteUrl}/dashboard/orders`,
    }),
    organizationId: params.organizationId,
  });
}

// ─── Order created (from dashboard) ─────────────────────────────────────────

export async function triggerDashboardOrderEmail(params: {
  organizationId: string;
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  productName: string;
  eventDate: string;
  total: number;
}) {
  if (!params.customerEmail) return;

  const branding = await getOrgBranding(params.organizationId);

  await sendEmail({
    to: branding.supportEmail,
    subject: `New order #${params.orderNumber} created from dashboard`,
    html: newOrderAlertEmail({
      businessName: branding.businessName,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      orderNumber: params.orderNumber,
      productName: params.productName,
      eventDate: formatDate(params.eventDate),
      total: formatMoney(params.total),
      source: "dashboard",
      dashboardUrl: `${branding.siteUrl}/dashboard/orders`,
    }),
    organizationId: params.organizationId,
  });
}

// ─── Payment received ───────────────────────────────────────────────────────

export async function triggerPaymentReceivedEmail(params: {
  organizationId: string;
  customerFirstName: string;
  customerEmail: string;
  orderNumber: string;
  amount: number;
  paymentType: string;
  paymentMethod: string;
  newBalance: number;
}) {
  if (!params.customerEmail) return;

  const branding = await getOrgBranding(params.organizationId);

  if (params.paymentType === "refund") {
    await sendEmail({
      to: params.customerEmail,
      subject: `Refund processed for order #${params.orderNumber} — ${branding.businessName}`,
      html: refundProcessedEmail({
        businessName: branding.businessName,
        customerFirstName: params.customerFirstName,
        orderNumber: params.orderNumber,
        amount: formatMoney(params.amount),
        supportEmail: branding.supportEmail,
      }),
      replyTo: branding.supportEmail,
      organizationId: params.organizationId,
    });
  } else {
    await sendEmail({
      to: params.customerEmail,
      subject: `Payment received for order #${params.orderNumber} — ${branding.businessName}`,
      html: paymentReceivedEmail({
        businessName: branding.businessName,
        customerFirstName: params.customerFirstName,
        orderNumber: params.orderNumber,
        amount: formatMoney(params.amount),
        paymentType: params.paymentType,
        paymentMethod: params.paymentMethod.replace(/_/g, " "),
        newBalance: formatMoney(params.newBalance),
        supportEmail: branding.supportEmail,
      }),
      replyTo: branding.supportEmail,
      organizationId: params.organizationId,
    });
  }
}

// ─── Order status update ────────────────────────────────────────────────────

const EMAIL_WORTHY_STATUSES = [
  "confirmed",
  "scheduled",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
];

export async function triggerOrderStatusEmail(params: {
  organizationId: string;
  orderId: string;
  newStatus: string;
}) {
  if (!EMAIL_WORTHY_STATUSES.includes(params.newStatus)) return;

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  const { data: order } = await supabase
    .from("orders")
    .select("order_number, event_date, customer_id")
    .eq("id", params.orderId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (!order?.customer_id) return;

  const { data: customer } = await supabase
    .from("customers")
    .select("first_name, email")
    .eq("id", order.customer_id)
    .maybeSingle();

  if (!customer?.email) return;

  const branding = await getOrgBranding(params.organizationId);

  await sendEmail({
    to: customer.email,
    subject: `Order #${order.order_number} — ${params.newStatus.replace(/_/g, " ")} — ${branding.businessName}`,
    html: orderStatusUpdateEmail({
      businessName: branding.businessName,
      customerFirstName: customer.first_name ?? "there",
      orderNumber: order.order_number,
      newStatus: params.newStatus,
      eventDate: order.event_date ? formatDate(order.event_date) : "TBD",
      supportEmail: branding.supportEmail,
    }),
    replyTo: branding.supportEmail,
    organizationId: params.organizationId,
  });
}

// ─── Documents ready ────────────────────────────────────────────────────────

export async function triggerDocumentsReadyEmail(params: {
  organizationId: string;
  orderId: string;
  customerId: string;
  documentTypes: string[];
}) {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  const [{ data: customer }, { data: order }] = await Promise.all([
    supabase
      .from("customers")
      .select("first_name, email")
      .eq("id", params.customerId)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("order_number")
      .eq("id", params.orderId)
      .maybeSingle(),
  ]);

  if (!customer?.email || !order) return;

  const branding = await getOrgBranding(params.organizationId);

  await sendEmail({
    to: customer.email,
    subject: `Documents ready for order #${order.order_number} — ${branding.businessName}`,
    html: documentsReadyEmail({
      businessName: branding.businessName,
      customerFirstName: customer.first_name ?? "there",
      orderNumber: order.order_number,
      documentTypes: params.documentTypes,
      supportEmail: branding.supportEmail,
    }),
    replyTo: branding.supportEmail,
    organizationId: params.organizationId,
  });
}
