import { sendEmail, listUnsubscribeMailtoHeader } from "./send";
import {
  orderConfirmationEmail,
  newOrderAlertEmail,
  paymentReceivedEmail,
  refundProcessedEmail,
  orderStatusUpdateEmail,
  documentsReadyEmail,
  quoteSentEmail,
  depositReminderEmail,
  balanceDueReminderEmail,
  operatorActivityAlertEmail,
  type OperatorActivityEvent,
} from "./templates";
import { resolveEmailLocale, emailCopy, type EmailLocale } from "./email-i18n";
import { getOrgPrimaryVerticalSlug } from "@/lib/verticals/org-verticals";
import { isGeneralVertical } from "@/lib/verticals/customer-language";
import { createNotification } from "@/lib/data/notifications";
import { issuePortalAccessToken } from "@/lib/portal/access-token";
import { sanitizeHeaderValue, strictParseEmail } from "@/lib/security/header-safe";
import {
  formatMoney as formatMoneyIntl,
  formatEventDate as formatEventDateIntl,
} from "@/lib/i18n/format-helpers";

/**
 * Build standard headers we want on every customer-facing transactional
 * email: List-Unsubscribe pointing at the operator's support address
 * (Gmail/Yahoo bulk-sender baseline) plus a Reply-To override so
 * customers can actually reply to a real human.
 */
function customerHeaders(supportEmail: string | null): Record<string, string> {
  if (!supportEmail) return {};
  return listUnsubscribeMailtoHeader(supportEmail);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeFormatters(currency: string, locale: string) {
  return {
    money: (amount: number) => formatMoneyIntl(amount, currency, locale),
    date: (dateStr: string) =>
      formatEventDateIntl(dateStr, locale, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
  };
}

type SupabaseLike = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        eq: (col: string, val: string) => {
          is: (col: string, val: null) => {
            maybeSingle: () => Promise<{ data: { preferred_locale?: string | null } | null }>;
          };
        };
      };
    };
  };
};

/**
 * Resolve a customer's preferred email locale by customer id, scoped to the
 * org. Falls back to "en" for unknown customers or unsupported locale values.
 */
async function resolveCustomerLocaleById(
  supabase: SupabaseLike,
  organizationId: string,
  customerId: string
): Promise<EmailLocale> {
  const { data } = await supabase
    .from("customers")
    .select("preferred_locale")
    .eq("id", customerId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  return resolveEmailLocale(data?.preferred_locale ?? null);
}

/**
 * Resolve a customer's preferred email locale by email address, scoped to the
 * org. Used by triggers that only have the recipient's email on hand.
 * Falls back to "en".
 */
async function resolveCustomerLocaleByEmail(
  supabase: SupabaseLike,
  organizationId: string,
  customerEmail: string
): Promise<EmailLocale> {
  if (!customerEmail) return "en";
  const { data } = await supabase
    .from("customers")
    .select("preferred_locale")
    .eq("email", customerEmail)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  return resolveEmailLocale(data?.preferred_locale ?? null);
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
  currency: string;
  locale: string;
  // Operator's explicitly-set brand color (hex) or null when uncustomized.
  brandColor: string | null;
};

function buildFromAddress(businessName: string): string {
  const rawAddress = process.env.EMAIL_FROM_ADDRESS ?? "noreply@korent.app";
  // Strip any existing display name to get just the email address.
  const emailOnly = rawAddress.replace(/^.*<(.+)>$/, "$1").trim();
  // Validate strictly — a malformed EMAIL_FROM_ADDRESS env (extra
  // angle brackets, embedded CRLF, semicolons) would otherwise be
  // passed straight to Resend / SMTP and either rejected or, worse,
  // parsed in surprising ways. Fall back to a sane default.
  const validatedEmail = strictParseEmail(emailOnly) ?? "noreply@korent.app";
  const safeName = businessName.replace(/[\r\n\t]/g, "").replace(/[^\w\s'-]/g, "").trim() || "Rental Company";
  return `${safeName} <${validatedEmail}>`;
}

async function getOrgBranding(
  organizationId: string
): Promise<OrgBranding> {
  // Use the ADMIN client, not the request-scoped anon client. Triggers
  // run from contexts with NO auth session and no x-storefront-slug
  // header — most importantly the Stripe webhook (the common
  // deposit-paid path). Under those conditions RLS returns zero rows for
  // both `organizations` and `organization_memberships`, so the org's
  // support_email AND the owner-email fallback resolved to null and the
  // operator new-order alert was silently skipped. The cron reminder
  // path already resolves branding with the admin client; mirror it.
  // (Dynamic import also avoids circular dependencies.)
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createSupabaseAdminClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("name, support_email, event_timezone, default_currency, settings")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  const businessName = org?.name ?? "Rental Company";
  const supportEmail = org?.support_email ?? null;
  const eventTimezone = org?.event_timezone ?? "UTC";
  const currency = (org as { default_currency?: string | null } | null)?.default_currency ?? "USD";
  const rawBrand =
    ((org?.settings as Record<string, unknown> | null)?.brand_primary_color as string | undefined) ?? null;

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

  // The whole point of the admin-client switch above is that this should
  // now resolve. If it still doesn't (org with neither a support_email
  // nor an active owner), the operator alert is skipped — make that
  // visible instead of silent, so it can't regress unnoticed again.
  if (!operatorAlertEmail) {
    try {
      const { logAppError } = await import("@/lib/observability/server");
      await logAppError({
        organizationId,
        source: "email.operator_alert",
        message:
          "No operator alert recipient resolved (no support_email and no active owner email) — new-order alert skipped",
      });
    } catch {
      /* never let logging break the email path */
    }
  }

  return {
    businessName,
    supportEmail,
    operatorAlertEmail,
    eventTimezone,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    fromAddress: buildFromAddress(businessName),
    currency,
    // No per-org locale today — default to English. When orgs gain a locale
    // setting, surface it here so emails honor it.
    locale: "en",
    brandColor: rawBrand,
  };
}

// ─── Order created (from website checkout) ──────────────────────────────────

export async function triggerOrderConfirmationEmail(params: {
  organizationId: string;
  customerFirstName: string;
  customerEmail: string;
  orderNumber: string;
  /** Single-line summary of the order's products. For multi-item carts
   *  this is a comma-joined list; used for the operator alert + the
   *  in-app notification headline. */
  productName: string;
  /** Phase 3b — multi-item carts pass the full rental line list so the
   *  confirmation email renders all N products as a list. Only
   *  `line_type='rental'` parents are passed (add-on / waiver children
   *  are folded into their parent's price). When omitted, the single
   *  `productName` row is rendered as before. */
  items?: { name: string; quantity: number; lineTotal: string }[];
  eventDate: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  depositDue: number;
}) {
  const branding = await getOrgBranding(params.organizationId);
  const fmt = makeFormatters(branding.currency, branding.locale);

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();

  // Customer-facing email is rendered in the recipient's preferred locale.
  const customerLocale = await resolveCustomerLocaleByEmail(
    supabase as unknown as SupabaseLike,
    params.organizationId,
    params.customerEmail
  );
  const cfmt = makeFormatters(branding.currency, customerLocale);

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
    subject: sanitizeHeaderValue(emailCopy(customerLocale).subjects.orderConfirmation(params.orderNumber, branding.businessName)),
    html: orderConfirmationEmail({
      businessName: branding.businessName,
      brandColor: branding.brandColor,
      customerFirstName: params.customerFirstName,
      orderNumber: params.orderNumber,
      productName: params.productName,
      items: params.items,
      eventDate: cfmt.date(params.eventDate),
      subtotal: cfmt.money(params.subtotal),
      deliveryFee: cfmt.money(params.deliveryFee),
      total: cfmt.money(params.total),
      depositDue: cfmt.money(params.depositDue),
      supportEmail: branding.supportEmail,
      siteUrl: branding.siteUrl,
      portalUrl,
      locale: customerLocale,
    }),
    replyTo: branding.supportEmail ?? undefined,
      headers: customerHeaders(branding.supportEmail),
    organizationId: params.organizationId,
    orderId: order?.id ?? null,
  });

  // Alert to operator
  if (branding.operatorAlertEmail) {
    await sendEmail({
      to: branding.operatorAlertEmail,
      from: branding.fromAddress,
      subject: sanitizeHeaderValue(`New order #${params.orderNumber} from website`),
      html: newOrderAlertEmail({
        businessName: branding.businessName,
        brandColor: branding.brandColor,
        customerName: params.customerFirstName,
        customerEmail: params.customerEmail,
        orderNumber: params.orderNumber,
        productName: params.productName,
        eventDate: fmt.date(params.eventDate),
        total: fmt.money(params.total),
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
  // NOTE: this trigger only emails the OPERATOR (new-order alert) and
  // persists an in-app notification — it sends nothing to the customer.
  // It must therefore fire regardless of whether the customer has an
  // email on file. (Previously it early-returned on an empty
  // customerEmail, silently dropping the operator's new-order alert for
  // any dashboard order created without a customer email.)
  const branding = await getOrgBranding(params.organizationId);
  const fmt = makeFormatters(branding.currency, branding.locale);

  if (branding.operatorAlertEmail) {
    await sendEmail({
      to: branding.operatorAlertEmail,
      from: branding.fromAddress,
      subject: sanitizeHeaderValue(`New order #${params.orderNumber} created from dashboard`),
      html: newOrderAlertEmail({
        businessName: branding.businessName,
        brandColor: branding.brandColor,
        customerName: params.customerName,
        customerEmail: params.customerEmail,
        orderNumber: params.orderNumber,
        productName: params.productName,
        eventDate: fmt.date(params.eventDate),
        total: fmt.money(params.total),
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
  const fmt = makeFormatters(branding.currency, branding.locale);

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const customerLocale = await resolveCustomerLocaleByEmail(
    supabase as unknown as SupabaseLike,
    params.organizationId,
    params.customerEmail
  );
  const cfmt = makeFormatters(branding.currency, customerLocale);
  const general = isGeneralVertical(
    await getOrgPrimaryVerticalSlug(supabase as unknown as { from: (t: string) => unknown }, params.organizationId)
  );

  if (params.paymentType === "refund") {
    await sendEmail({
      to: params.customerEmail,
      from: branding.fromAddress,
      subject: sanitizeHeaderValue(emailCopy(customerLocale).subjects.refundProcessed(params.orderNumber, branding.businessName)),
      html: refundProcessedEmail({
        businessName: branding.businessName,
        brandColor: branding.brandColor,
        customerFirstName: params.customerFirstName,
        orderNumber: params.orderNumber,
        amount: cfmt.money(params.amount),
        supportEmail: branding.supportEmail,
        locale: customerLocale,
      }),
      replyTo: branding.supportEmail ?? undefined,
      headers: customerHeaders(branding.supportEmail),
      organizationId: params.organizationId,
    });
  } else {
    await sendEmail({
      to: params.customerEmail,
      from: branding.fromAddress,
      subject: sanitizeHeaderValue(emailCopy(customerLocale).subjects.paymentReceived(params.orderNumber, branding.businessName)),
      html: paymentReceivedEmail({
        businessName: branding.businessName,
        brandColor: branding.brandColor,
        customerFirstName: params.customerFirstName,
        orderNumber: params.orderNumber,
        amount: cfmt.money(params.amount),
        paymentType: params.paymentType,
        paymentMethod: params.paymentMethod.replace(/_/g, " "),
        newBalance: cfmt.money(params.newBalance),
        supportEmail: branding.supportEmail,
        locale: customerLocale,
        general,
        fullyPaid: params.newBalance <= 0,
      }),
      replyTo: branding.supportEmail ?? undefined,
      headers: customerHeaders(branding.supportEmail),
      organizationId: params.organizationId,
    });
  }

  // Persist notification
  await createNotification(
    params.organizationId,
    "payment_received",
    params.paymentType === "refund" ? "Refund processed" : "Payment received",
    `${fmt.money(params.amount)} for order #${params.orderNumber}`,
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
    .select("first_name, email, preferred_locale")
    .eq("id", order.customer_id)
    .eq("organization_id", params.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!customer?.email) return;

  const branding = await getOrgBranding(params.organizationId);
  const customerLocale = resolveEmailLocale(
    (customer as { preferred_locale?: string | null }).preferred_locale ?? null
  );
  const fmt = makeFormatters(branding.currency, customerLocale);
  const general = isGeneralVertical(
    await getOrgPrimaryVerticalSlug(supabase as unknown as { from: (t: string) => unknown }, params.organizationId)
  );

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
          deliveryTimeWindow = emailCopy(customerLocale).aroundTime(windowStart);
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
    subject: sanitizeHeaderValue(
      (() => {
        const sc = emailCopy(customerLocale).orderStatus;
        const statusText = sc.statuses[params.newStatus as keyof typeof sc.statuses]?.heading ?? sc.fallbackHeading;
        return emailCopy(customerLocale).subjects.orderStatus(order.order_number, branding.businessName, statusText);
      })()
    ),
    html: orderStatusUpdateEmail({
      businessName: branding.businessName,
      brandColor: branding.brandColor,
      customerFirstName: customer.first_name ?? "there",
      orderNumber: order.order_number,
      newStatus: params.newStatus,
      eventDate: order.event_date ? fmt.date(order.event_date) : "TBD",
      supportEmail: branding.supportEmail,
      deliveryTimeWindow,
      crewName,
      portalUrl,
      locale: customerLocale,
      general,
    }),
    replyTo: branding.supportEmail ?? undefined,
      headers: customerHeaders(branding.supportEmail),
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
      .select("first_name, email, preferred_locale")
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
  const customerLocale = resolveEmailLocale(
    (customer as { preferred_locale?: string | null }).preferred_locale ?? null
  );

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
    subject: sanitizeHeaderValue(emailCopy(customerLocale).subjects.documentsReady(order.order_number, branding.businessName)),
    html: documentsReadyEmail({
      businessName: branding.businessName,
      brandColor: branding.brandColor,
      customerFirstName: customer.first_name ?? "there",
      orderNumber: order.order_number,
      documentTypes: params.documentTypes,
      supportEmail: branding.supportEmail,
      portalUrl,
      locale: customerLocale,
    }),
    replyTo: branding.supportEmail ?? undefined,
      headers: customerHeaders(branding.supportEmail),
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
      .select("first_name, email, preferred_locale")
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
  const customerLocale = resolveEmailLocale(
    (customer as { preferred_locale?: string | null }).preferred_locale ?? null
  );
  const fmt = makeFormatters(branding.currency, customerLocale);

  const portalToken = await import("@/lib/portal/access-token").then(({ issuePortalAccessToken }) =>
    issuePortalAccessToken({ supabase, orderId: params.orderId }).catch(() => null)
  );
  const portalUrl = portalToken
    ? `${branding.siteUrl}/order-status?token=${encodeURIComponent(portalToken)}`
    : `${branding.siteUrl}/order-status`;

  const eventDate = order.event_date ? fmt.date(order.event_date) : "TBD";

  await sendEmail({
    to: customer.email,
    from: branding.fromAddress,
    subject: sanitizeHeaderValue(emailCopy(customerLocale).subjects.quoteSent(params.orderNumber, branding.businessName)),
    html: quoteSentEmail({
      businessName: branding.businessName,
      brandColor: branding.brandColor,
      customerFirstName: customer.first_name ?? "there",
      orderNumber: params.orderNumber,
      eventDate,
      total: fmt.money(Number(order.total_amount ?? 0)),
      depositRequired: fmt.money(Number(order.deposit_due_amount ?? 0)),
      portalUrl,
      supportEmail: branding.supportEmail,
      locale: customerLocale,
    }),
    replyTo: branding.supportEmail ?? undefined,
      headers: customerHeaders(branding.supportEmail),
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

// ─── Deposit reminder (customer-facing) ───────────────────────────────────

/**
 * Email a customer reminding them their booking is held but the deposit
 * is not yet paid. Wired into the morning reminders cron — runs once per
 * order, keyed on `orders.deposit_reminder_sent_at` (writeable by the
 * cron via the admin client).
 */
export async function triggerDepositReminderEmail(params: {
  organizationId: string;
  customerFirstName: string;
  customerEmail: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  eventDate: string;
  depositDue: number;
}): Promise<boolean> {
  if (!params.customerEmail) return false;

  const branding = await getOrgBranding(params.organizationId);

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const customerLocale = await resolveCustomerLocaleByEmail(
    supabase as unknown as SupabaseLike,
    params.organizationId,
    params.customerEmail
  );
  const fmt = makeFormatters(branding.currency, customerLocale);

  const portalToken = await issuePortalAccessToken({ supabase, orderId: params.orderId }).catch(
    () => null
  );
  const portalUrl = portalToken
    ? `${branding.siteUrl}/order-status?token=${encodeURIComponent(portalToken)}`
    : `${branding.siteUrl}/order-status`;

  return sendEmail({
    to: params.customerEmail,
    from: branding.fromAddress,
    subject: sanitizeHeaderValue(emailCopy(customerLocale).subjects.depositReminder(params.orderNumber, branding.businessName)),
    html: depositReminderEmail({
      businessName: branding.businessName,
      brandColor: branding.brandColor,
      customerFirstName: params.customerFirstName,
      orderNumber: params.orderNumber,
      productName: params.productName,
      eventDate: fmt.date(params.eventDate),
      depositDue: fmt.money(params.depositDue),
      portalUrl,
      supportEmail: branding.supportEmail,
      locale: customerLocale,
    }),
    replyTo: branding.supportEmail ?? undefined,
    headers: customerHeaders(branding.supportEmail),
    preheader: `Pay your deposit to confirm order #${params.orderNumber} for ${fmt.date(params.eventDate)}.`,
    idempotencyKey: `deposit_reminder:${params.orderId}`,
    organizationId: params.organizationId,
    orderId: params.orderId,
  });
}

/**
 * Customer balance-due reminder: confirmed order, deposit paid, remaining
 * balance still owed as the rental date approaches. Drives the customer to
 * the portal (where PayBalanceButton opens a Stripe checkout for the
 * balance). Idempotent per order via the email idempotency key; the cron
 * additionally guards on orders.balance_reminder_sent_at.
 */
export async function triggerBalanceDueReminderEmail(params: {
  organizationId: string;
  customerFirstName: string;
  customerEmail: string;
  orderId: string;
  orderNumber: string;
  productName: string;
  eventDate: string;
  balanceDue: number;
}): Promise<boolean> {
  if (!params.customerEmail) return false;

  const branding = await getOrgBranding(params.organizationId);

  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const customerLocale = await resolveCustomerLocaleByEmail(
    supabase as unknown as SupabaseLike,
    params.organizationId,
    params.customerEmail
  );
  const fmt = makeFormatters(branding.currency, customerLocale);

  const portalToken = await issuePortalAccessToken({ supabase, orderId: params.orderId }).catch(
    () => null
  );
  const portalUrl = portalToken
    ? `${branding.siteUrl}/order-status?token=${encodeURIComponent(portalToken)}`
    : `${branding.siteUrl}/order-status`;

  return sendEmail({
    to: params.customerEmail,
    from: branding.fromAddress,
    subject: sanitizeHeaderValue(emailCopy(customerLocale).subjects.balanceReminder(params.orderNumber, branding.businessName)),
    html: balanceDueReminderEmail({
      businessName: branding.businessName,
      brandColor: branding.brandColor,
      customerFirstName: params.customerFirstName,
      orderNumber: params.orderNumber,
      productName: params.productName,
      eventDate: fmt.date(params.eventDate),
      balanceDue: fmt.money(params.balanceDue),
      portalUrl,
      supportEmail: branding.supportEmail,
      locale: customerLocale,
    }),
    replyTo: branding.supportEmail ?? undefined,
    headers: customerHeaders(branding.supportEmail),
    preheader: `Pay your ${fmt.money(params.balanceDue)} balance for order #${params.orderNumber}.`,
    idempotencyKey: `balance_reminder:${params.orderId}`,
    organizationId: params.organizationId,
    orderId: params.orderId,
  });
}

// ─── Refund operator alert ────────────────────────────────────────────────

/**
 * Notify the operator that a refund just landed. Complements the
 * customer-facing `refundProcessedEmail` already sent by
 * `triggerPaymentReceivedEmail` when `paymentType === "refund"`.
 *
 * Refund webhooks fire on Stripe retries, so this trigger is idempotent
 * via the (orderId, providerPaymentId) key.
 */
export async function triggerRefundOperatorAlertEmail(params: {
  organizationId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  providerPaymentId?: string;
}) {
  const branding = await getOrgBranding(params.organizationId);
  if (!branding.operatorAlertEmail) return;
  const fmt = makeFormatters(branding.currency, branding.locale);

  const detail = `Refund of ${fmt.money(params.amount)} processed`;
  const idempotencyKey = `refund_alert:${params.orderId}:${params.providerPaymentId ?? "manual"}`;

  await sendEmail({
    to: branding.operatorAlertEmail,
    from: branding.fromAddress,
    subject: `Refund processed on order #${params.orderNumber} — ${branding.businessName}`,
    html: newOrderAlertEmail({
      businessName: branding.businessName,
      brandColor: branding.brandColor,
      customerName: params.customerName,
      customerEmail: "",
      orderNumber: params.orderNumber,
      productName: detail,
      eventDate: "",
      total: fmt.money(params.amount),
      source: "dashboard",
      dashboardUrl: `${branding.siteUrl}/dashboard/orders/${params.orderId}`,
    }),
    organizationId: params.organizationId,
    orderId: params.orderId,
    idempotencyKey,
  });

  await createNotification(
    params.organizationId,
    "payment_received",
    "Refund processed",
    `#${params.orderNumber} — ${fmt.money(params.amount)}`,
    `/dashboard/orders/${params.orderId}`
  );
}

// ─── Operator activity alert (customer-initiated events) ───────────────────

/**
 * Email the operator when a customer takes a self-service action on
 * the portal: paid, signed a doc, accepted a quote, cancelled, or
 * sent a message. Sends only to `branding.operatorAlertEmail` (the org
 * support email, falling back to the owner profile). Also writes an
 * in-app `notifications` row so the bell in the dashboard lights up.
 *
 * Silent no-op when the org has no operator address configured —
 * shouldn't happen post-onboarding but keeps the path safe in dev.
 */
export async function triggerOperatorActivityAlertEmail(params: {
  organizationId: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  event: OperatorActivityEvent;
  detail?: string;
}): Promise<void> {
  const branding = await getOrgBranding(params.organizationId);
  if (!branding.operatorAlertEmail) return;

  const dashboardUrl = `${branding.siteUrl}/dashboard/orders/${params.orderId}`;

  await sendEmail({
    to: branding.operatorAlertEmail,
    from: branding.fromAddress,
    subject: subjectForEvent(params.event, params.orderNumber, branding.businessName),
    html: operatorActivityAlertEmail({
      businessName: branding.businessName,
      brandColor: branding.brandColor,
      event: params.event,
      orderNumber: params.orderNumber,
      customerName: params.customerName,
      detail: params.detail,
      dashboardUrl,
    }),
    organizationId: params.organizationId,
    orderId: params.orderId,
  });

  await createNotification(
    params.organizationId,
    notificationTypeForEvent(params.event),
    headlineForEvent(params.event),
    `#${params.orderNumber} — ${params.customerName}${params.detail ? ` — ${params.detail}` : ""}`,
    `/dashboard/orders/${params.orderId}`
  );
}

function subjectForEvent(event: OperatorActivityEvent, orderNumber: string, businessName: string): string {
  switch (event) {
    case "payment_received":
      return `Payment received on order #${orderNumber} — ${businessName}`;
    case "document_signed":
      return `Document signed on order #${orderNumber} — ${businessName}`;
    case "quote_accepted":
      return `Quote accepted on order #${orderNumber} — ${businessName}`;
    case "quote_requested":
      return `Quote requested — order #${orderNumber} — ${businessName}`;
    case "order_cancelled":
      return `Order #${orderNumber} cancelled by customer — ${businessName}`;
    case "portal_message":
      return `New customer message on order #${orderNumber} — ${businessName}`;
  }
}

function headlineForEvent(event: OperatorActivityEvent): string {
  switch (event) {
    case "payment_received":
      return "Customer paid";
    case "document_signed":
      return "Document signed";
    case "quote_accepted":
      return "Quote accepted";
    case "quote_requested":
      return "Quote requested";
    case "order_cancelled":
      return "Order cancelled";
    case "portal_message":
      return "New customer message";
  }
}

function notificationTypeForEvent(event: OperatorActivityEvent) {
  switch (event) {
    case "payment_received":
      return "payment_received" as const;
    case "document_signed":
      return "new_order" as const; // closest available notification type today
    case "quote_accepted":
      return "order_confirmed" as const;
    case "quote_requested":
      return "new_order" as const;
    case "order_cancelled":
      return "new_order" as const;
    case "portal_message":
      return "new_message" as const;
  }
}
