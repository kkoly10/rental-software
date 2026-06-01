import { sendEmail } from "./send";
import {
  orderConfirmationEmail,
  newOrderAlertEmail,
  paymentReceivedEmail,
  refundProcessedEmail,
  orderStatusUpdateEmail,
  documentsReadyEmail,
  quoteSentEmail,
} from "./templates";
import { createNotification } from "@/lib/data/notifications";
import { issuePortalAccessToken } from "@/lib/portal/access-token";

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
  supportEmail: string | null;
  // Where to send operator-facing alerts (new order, payment received, etc).
  // Falls back to the org owner's profile email when support_email is unset,
  // so internal notifications never get dropped.
  operatorAlertEmail: string | null;
  siteUrl: string;
  fromAddress: string;
  // IANA tz used to render customer-facing time windows. Defaults to
  // "UTC" if the org hasn't configured one (was: server-local).
  eventTimezone: string;
};

function buildFromAddress(businessName: string): string {
  const rawAddress = process.env.EMAIL_FROM_ADDRESS ?? "noreply@korent.app";
  // Strip any existing display name to get just the email address
  const emailOnly = rawAddress.replace(/^.*<(.+)>$/, "$1").trim();
  const safeName = businessName.replace(/[\r\n\t]/g, "").replace(/[^\w\s'-]/g, "").trim() || "Rental Company";
  return `${safeName} <${emailOnly}>`;
}

async function getOrgBranding(
  organizationId: string
): Promise<OrgBranding> {
  // Dynamic import to avoid circular dependencies
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("name, support_email, event_timezone")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  const businessName = org?.name ?? "Rental Company";
  const supportEmail = org?.support_email ?? null;
  const eventTimezone = org?.event_timezone ?? "UTC";

  let operatorAlertEmail = supportEmail;
  if (!operatorAlertEmail) {
    const { data: ownerMembership } = await supabase
      .from("organization_memberships")
      .select("profiles(email)")
      .eq("organization_id", organizationId)
      .eq("role", "owner")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    const ownerEmail = (ownerMembership as { profiles?: { email?: string | null } | null } | null)
      ?.profiles?.email;
    operatorAlertEmail = ownerEmail ?? null;
  }

  return {
    businessName,
    supportEmail,
    operatorAlertEmail,
    eventTimezone,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    fromAddress: buildFromAddress(businessName),
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

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("order_number", params.orderNumber)
    .is("deleted_at", null)
    .maybeSingle();

  const portalToken = order
    ? await issuePortalAccessToken({ supabase, orderId: order.id }).catch(() => null)
    : null;
  const portalUrl = portalToken
    ? `${branding.siteUrl}/order-status?token=${encodeURIComponent(portalToken)}`
    : `${branding.siteUrl}/order-status`;

  // Email to customer
  await sendEmail({
    to: params.customerEmail,
    from: branding.fromAddress,
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
      portalUrl,
    }),
    replyTo: branding.supportEmail ?? undefined,
    organizationId: params.organizationId,
    orderId: order?.id ?? null,
  });

  // Alert to operator
  if (branding.operatorAlertEmail) {
    await sendEmail({
      to: branding.operatorAlertEmail,
      from: branding.fromAddress,
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

  // Persist notification
  await createNotification(
    params.organizationId,
    "new_order",
    "New order received",
    `#${params.orderNumber} — ${params.productName} — ${params.customerFirstName}`,
    "/dashboard/orders"
  );
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

  if (branding.operatorAlertEmail) {
    await sendEmail({
      to: branding.operatorAlertEmail,
      from: branding.fromAddress,
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

  // Persist notification
  await createNotification(
    params.organizationId,
    "new_order",
    "New order created",
    `#${params.orderNumber} — ${params.productName} — ${params.customerName}`,
    "/dashboard/orders"
  );
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
      from: branding.fromAddress,
      subject: `Refund processed for order #${params.orderNumber} — ${branding.businessName}`,
      html: refundProcessedEmail({
        businessName: branding.businessName,
        customerFirstName: params.customerFirstName,
        orderNumber: params.orderNumber,
        amount: formatMoney(params.amount),
        supportEmail: branding.supportEmail,
      }),
      replyTo: branding.supportEmail ?? undefined,
      organizationId: params.organizationId,
    });
  } else {
    await sendEmail({
      to: params.customerEmail,
      from: branding.fromAddress,
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
      replyTo: branding.supportEmail ?? undefined,
      organizationId: params.organizationId,
    });
  }

  // Persist notification
  await createNotification(
    params.organizationId,
    "payment_received",
    params.paymentType === "refund" ? "Refund processed" : "Payment received",
    `${formatMoney(params.amount)} for order #${params.orderNumber}`,
    "/dashboard/payments"
  );
}

// ─── Order status update ────────────────────────────────────────────────────

const EMAIL_WORTHY_STATUSES = [
  "awaiting_deposit",
  "confirmed",
  "scheduled",
  "out_for_delivery",
  "delivered",
  "completed",
  "cancelled",
  // #353 webhook flips delivered → refunded after a full refund; without
  // this the customer only gets the refund-payment receipt, never the
  // booking-status update.
  "refunded",
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
    .is("deleted_at", null)
    .maybeSingle();

  if (!order?.customer_id) return;

  const { data: customer } = await supabase
    .from("customers")
    .select("first_name, email")
    .eq("id", order.customer_id)
    .eq("organization_id", params.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!customer?.email) return;

  const branding = await getOrgBranding(params.organizationId);

  // Fetch delivery details for scheduled / out_for_delivery statuses
  let deliveryTimeWindow: string | undefined;
  let crewName: string | undefined;

  if (params.newStatus === "scheduled" || params.newStatus === "out_for_delivery") {
    try {
      const { data: stop } = await supabase
        .from("route_stops")
        .select(
          "scheduled_window_start, scheduled_window_end, routes(name, profiles(full_name))"
        )
        .eq("order_id", params.orderId)
        .limit(1)
        .maybeSingle();

      if (stop) {
        const { formatTimeInTimeZone } = await import("@/lib/datetime/event-time");
        const windowStart = stop.scheduled_window_start
          ? formatTimeInTimeZone(stop.scheduled_window_start, branding.eventTimezone)
          : null;
        const windowEnd = stop.scheduled_window_end
          ? formatTimeInTimeZone(stop.scheduled_window_end, branding.eventTimezone)
          : null;

        if (windowStart && windowEnd) {
          deliveryTimeWindow = `${windowStart} – ${windowEnd}`;
        } else if (windowStart) {
          deliveryTimeWindow = `Around ${windowStart}`;
        }

        const route = (stop as Record<string, unknown>).routes as {
          name?: string;
          profiles?: { full_name?: string } | null;
        } | null;

        crewName = route?.profiles?.full_name || undefined;
      }
    } catch {
      // Graceful fallback — email still sends without delivery details
    }
  }

  // For awaiting_deposit (quote accepted), issue/re-use portal token so customer can pay
  let portalUrl: string | undefined;
  if (params.newStatus === "awaiting_deposit") {
    try {
      const portalToken = await issuePortalAccessToken({ supabase, orderId: params.orderId });
      portalUrl = `${branding.siteUrl}/order-status?token=${encodeURIComponent(portalToken)}`;
    } catch {
      portalUrl = `${branding.siteUrl}/order-status`;
    }
  }

  await sendEmail({
    to: customer.email,
    from: branding.fromAddress,
    subject: `Order #${order.order_number} — ${params.newStatus.replace(/_/g, " ")} — ${branding.businessName}`,
    html: orderStatusUpdateEmail({
      businessName: branding.businessName,
      customerFirstName: customer.first_name ?? "there",
      orderNumber: order.order_number,
      newStatus: params.newStatus,
      eventDate: order.event_date ? formatDate(order.event_date) : "TBD",
      supportEmail: branding.supportEmail,
      deliveryTimeWindow,
      crewName,
      portalUrl,
    }),
    replyTo: branding.supportEmail ?? undefined,
    organizationId: params.organizationId,
    orderId: params.orderId,
    customerId: order.customer_id,
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
      .eq("organization_id", params.organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("order_number")
      .eq("id", params.orderId)
      .eq("organization_id", params.organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (!customer?.email || !order) return;

  const branding = await getOrgBranding(params.organizationId);

  // Issue a portal token so the customer can navigate directly to sign documents
  let portalUrl: string | undefined;
  try {
    const { issuePortalAccessToken: issueToken } = await import("@/lib/portal/access-token");
    const portalToken = await issueToken({ supabase, orderId: params.orderId });
    portalUrl = `${branding.siteUrl}/order-status?token=${encodeURIComponent(portalToken)}`;
  } catch {
    portalUrl = `${branding.siteUrl}/order-status`;
  }

  await sendEmail({
    to: customer.email,
    from: branding.fromAddress,
    subject: `Documents ready for order #${order.order_number} — ${branding.businessName}`,
    html: documentsReadyEmail({
      businessName: branding.businessName,
      customerFirstName: customer.first_name ?? "there",
      orderNumber: order.order_number,
      documentTypes: params.documentTypes,
      supportEmail: branding.supportEmail,
      portalUrl,
    }),
    replyTo: branding.supportEmail ?? undefined,
    organizationId: params.organizationId,
    orderId: params.orderId,
    customerId: params.customerId,
  });
}

// ─── Quote sent ──────────────────────────────────────────────────────────────

export async function triggerQuoteSentEmail(params: {
  organizationId: string;
  orderId: string;
  customerId: string;
  orderNumber: string;
}) {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  const [{ data: customer }, { data: order }] = await Promise.all([
    supabase
      .from("customers")
      .select("first_name, email")
      .eq("id", params.customerId)
      .eq("organization_id", params.organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("event_date, total_amount, deposit_due_amount")
      .eq("id", params.orderId)
      .eq("organization_id", params.organizationId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (!customer?.email || !order) return;

  const branding = await getOrgBranding(params.organizationId);

  const portalToken = await import("@/lib/portal/access-token").then(({ issuePortalAccessToken }) =>
    issuePortalAccessToken({ supabase, orderId: params.orderId }).catch(() => null)
  );
  const portalUrl = portalToken
    ? `${branding.siteUrl}/order-status?token=${encodeURIComponent(portalToken)}`
    : `${branding.siteUrl}/order-status`;

  const eventDate = order.event_date
    ? new Date(`${order.event_date}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "TBD";

  await sendEmail({
    to: customer.email,
    from: branding.fromAddress,
    subject: `Your quote for order #${params.orderNumber} — ${branding.businessName}`,
    html: quoteSentEmail({
      businessName: branding.businessName,
      customerFirstName: customer.first_name ?? "there",
      orderNumber: params.orderNumber,
      eventDate,
      total: formatMoney(Number(order.total_amount ?? 0)),
      depositRequired: formatMoney(Number(order.deposit_due_amount ?? 0)),
      portalUrl,
      supportEmail: branding.supportEmail,
    }),
    replyTo: branding.supportEmail ?? undefined,
    organizationId: params.organizationId,
  });

  await createNotification(
    params.organizationId,
    "new_order",
    "Quote sent",
    `#${params.orderNumber} — quote emailed to customer`,
    `/dashboard/orders/${params.orderId}`
  );
}
