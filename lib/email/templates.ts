/**
 * Shared email layout wrapper.
 * Inlines all styles for maximum email client compatibility.
 */

import { emailCopy, type EmailLocale } from "./email-i18n";

export type { EmailLocale } from "./email-i18n";

// Escapes the OWASP-recommended HTML5-context character set PLUS
// backtick (some legacy IE parsers treated it as a quote) and
// forward-slash (CDATA-context safety). Total cost: 7 substitutions.
// Output is safe for HTML body text and double-quoted attribute
// values; do NOT use inside unquoted attributes or inside <script>
// / <style> blocks.
function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/[&<>"'`/]/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;", "`": "&#x60;", "/": "&#x2F;" }[ch] ?? ch
  ));
}

function layout(
  businessName: string,
  body: string,
  footer?: string,
  preheader?: string,
  locale: EmailLocale = "en"
): string {
  const safeName = esc(businessName);
  const preheaderSpan = preheader
    ? `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</span>`
    : "";
  return `<!DOCTYPE html>
<html lang="${esc(locale)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#10233f;line-height:1.6;">
  ${preheaderSpan}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #dbe6f4;box-shadow:0 4px 12px rgba(16,35,63,0.06);overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e5dcf,#2d77f2);padding:24px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.01em;">${safeName}</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #dbe6f4;color:#55708f;font-size:13px;">
            ${footer ?? `<p style="margin:0;">Sent by ${safeName}</p>`}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(text: string, url: string): string {
  return `<a href="${esc(url)}" style="display:inline-block;padding:14px 28px;background:#1e5dcf;color:#ffffff;border-radius:999px;font-weight:600;font-size:14px;text-decoration:none;margin:16px 0;">
    ${esc(text)}
  </a>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;color:#55708f;font-size:14px;width:140px;vertical-align:top;">${esc(label)}</td>
    <td style="padding:8px 0;font-size:14px;font-weight:500;">${esc(value)}</td>
  </tr>`;
}

function detailTable(rows: [string, string][]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;">
    ${rows.map(([label, value]) => detailRow(label, value)).join("")}
  </table>`;
}

// ─── ORDER CONFIRMATION (customer-facing, from website checkout) ────────────

export type OrderConfirmationData = {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  productName: string;
  eventDate: string;
  subtotal: string;
  deliveryFee: string;
  total: string;
  depositDue: string;
  supportEmail: string | null;
  siteUrl: string;
  portalUrl: string;
  locale: EmailLocale;
};

export function orderConfirmationEmail(data: OrderConfirmationData): string {
  const t = emailCopy(data.locale);
  const c = t.orderConfirmation;
  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">${esc(c.heading)}</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      ${esc(c.intro(data.customerFirstName))}
    </p>

    ${detailTable([
      [t.labels.order, `#${data.orderNumber}`],
      [t.labels.item, data.productName],
      [t.labels.eventDate, data.eventDate],
      [t.labels.subtotal, data.subtotal],
      [t.labels.deliveryFee, data.deliveryFee],
      [t.labels.total, data.total],
    ])}

    <div style="background:#fff4e5;border:1px solid #fde2a7;border-radius:12px;padding:16px;margin:20px 0;">
      <strong style="color:#a86a08;">${esc(c.depositRequired(data.depositDue))}</strong>
      <p style="margin:8px 0 0;font-size:14px;color:#a86a08;">
        ${esc(c.depositInstructions)}
      </p>
    </div>

    ${button(c.button, data.portalUrl)}

    <p style="font-size:14px;color:#55708f;">
      ${esc(t.questions.replyOrContact(data.supportEmail))}
    </p>
    `,
    undefined,
    undefined,
    data.locale
  );
}

// ─── NEW ORDER ALERT (operator-facing) ─────────────────────────────────────

export type NewOrderAlertData = {
  businessName: string;
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  productName: string;
  eventDate: string;
  total: string;
  source: "website" | "dashboard";
  dashboardUrl: string;
};

export function newOrderAlertEmail(data: NewOrderAlertData): string {
  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">New order received</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      A new booking came in from your ${data.source === "website" ? "website" : "dashboard"}.
    </p>

    ${detailTable([
      ["Order", `#${data.orderNumber}`],
      ["Customer", data.customerName],
      ["Email", data.customerEmail],
      ["Item", data.productName],
      ["Event date", data.eventDate],
      ["Total", data.total],
    ])}

    ${button("View Order", data.dashboardUrl)}
    `
  );
}

// ─── OPERATOR ACTIVITY ALERT (customer-initiated events) ──────────────────

export type OperatorActivityEvent =
  | "payment_received"
  | "document_signed"
  | "quote_accepted"
  | "order_cancelled"
  | "portal_message";

export type OperatorActivityAlertData = {
  businessName: string;
  event: OperatorActivityEvent;
  orderNumber: string;
  customerName: string;
  /** Free-text detail rendered after the headline. e.g. "$250 deposit
   *  via Stripe", "Signed waiver", "Quote accepted; awaiting deposit",
   *  "I need to reschedule…" */
  detail?: string;
  dashboardUrl: string;
};

const EVENT_COPY: Record<OperatorActivityEvent, { headline: string; lead: string }> = {
  payment_received: {
    headline: "Customer paid",
    lead: "A payment came in through the customer portal.",
  },
  document_signed: {
    headline: "Document signed",
    lead: "The customer signed a document on the portal.",
  },
  quote_accepted: {
    headline: "Quote accepted",
    lead: "The customer accepted the quote and is being routed to deposit.",
  },
  order_cancelled: {
    headline: "Order cancelled by customer",
    lead: "The customer cancelled this booking from the portal.",
  },
  portal_message: {
    headline: "New customer message",
    lead: "The customer sent a message through the order portal.",
  },
};

export function operatorActivityAlertEmail(data: OperatorActivityAlertData): string {
  const copy = EVENT_COPY[data.event];
  const rows: [string, string][] = [
    ["Order", `#${data.orderNumber}`],
    ["Customer", data.customerName],
  ];
  if (data.detail) rows.push(["Detail", data.detail]);

  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">${copy.headline}</h1>
    <p style="color:#55708f;margin:0 0 20px;">${copy.lead}</p>

    ${detailTable(rows)}

    ${button("Open order", data.dashboardUrl)}
    `
  );
}

// ─── PAYMENT RECEIVED ───────────────────────────────────────────────────────

export type PaymentReceivedData = {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  amount: string;
  paymentType: string;
  paymentMethod: string;
  newBalance: string;
  supportEmail: string | null;
  locale: EmailLocale;
  // Whether the booking is now fully paid. Optional so callers that don't
  // pass it fall back to the legacy "$0.00" string check — but localized
  // money strings (e.g. "0,00 €") wouldn't match that, so the trigger now
  // passes this explicitly.
  fullyPaid?: boolean;
};

export function paymentReceivedEmail(data: PaymentReceivedData): string {
  const isFullyPaid = data.fullyPaid ?? data.newBalance === "$0.00";
  const t = emailCopy(data.locale);
  const c = t.paymentReceived;

  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">${esc(c.heading)}</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      ${esc(c.intro(data.customerFirstName, data.paymentType))}
    </p>

    ${detailTable([
      [t.labels.order, `#${data.orderNumber}`],
      [t.labels.amount, data.amount],
      [t.labels.method, data.paymentMethod],
      [t.labels.balanceRemaining, data.newBalance],
    ])}

    ${isFullyPaid
      ? `<div style="background:#eaf9f4;border:1px solid #b6e8d3;border-radius:12px;padding:16px;margin:20px 0;">
          <strong style="color:#188862;">${esc(c.fullyPaidTitle)}</strong>
          <p style="margin:8px 0 0;font-size:14px;color:#188862;">
            ${esc(c.fullyPaidBody)}
          </p>
        </div>`
      : `<p style="font-size:14px;color:#55708f;">
          ${esc(c.balanceDue(data.newBalance))}
        </p>`
    }

    ${data.supportEmail ? `<p style="font-size:14px;color:#55708f;">
      ${esc(t.questions.contactAt(data.supportEmail))}
    </p>` : ""}
    `,
    undefined,
    undefined,
    data.locale
  );
}

// ─── REFUND PROCESSED ───────────────────────────────────────────────────────

export type RefundProcessedData = {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  amount: string;
  supportEmail: string | null;
  locale: EmailLocale;
};

export function refundProcessedEmail(data: RefundProcessedData): string {
  const t = emailCopy(data.locale);
  const c = t.refundProcessed;
  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">${esc(c.heading)}</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      ${esc(c.intro(data.customerFirstName))}
    </p>

    ${detailTable([
      [t.labels.order, `#${data.orderNumber}`],
      [t.labels.refundAmount, data.amount],
    ])}

    <p style="font-size:14px;color:#55708f;">
      ${esc(c.timing)}${data.supportEmail ? esc(c.contactSuffix(data.supportEmail)) : ""}
    </p>
    `,
    undefined,
    undefined,
    data.locale
  );
}

// ─── ORDER STATUS UPDATE ────────────────────────────────────────────────────

export type OrderStatusUpdateData = {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  newStatus: string;
  eventDate: string;
  supportEmail: string | null;
  deliveryTimeWindow?: string;
  crewName?: string;
  portalUrl?: string;
  locale: EmailLocale;
};

export function orderStatusUpdateEmail(data: OrderStatusUpdateData): string {
  const t = emailCopy(data.locale);
  const c = t.orderStatus;
  const known = (c.statuses as Record<string, { heading: string; body: string }>)[data.newStatus];
  const msg = known ?? { heading: c.fallbackHeading, body: c.fallbackBody };

  const rows: [string, string][] = [
    [t.labels.order, `#${data.orderNumber}`],
    [t.labels.status, data.newStatus.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())],
    [t.labels.eventDate, data.eventDate],
  ];

  if (data.deliveryTimeWindow) {
    rows.push([t.labels.deliveryWindow, data.deliveryTimeWindow]);
  }
  if (data.crewName) {
    rows.push([t.labels.crew, data.crewName]);
  }

  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">${esc(msg.heading)}</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      ${esc(c.intro(data.customerFirstName))}
    </p>

    ${detailTable(rows)}

    <p style="font-size:14px;margin:16px 0;">${esc(msg.body)}</p>

    ${data.portalUrl ? `<p style="margin:20px 0;">
      <a href="${esc(data.portalUrl)}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block;">
        ${esc(c.button)}
      </a>
    </p>` : ""}

    ${data.supportEmail ? `<p style="font-size:14px;color:#55708f;">
      ${esc(t.questions.contactAt(data.supportEmail))}
    </p>` : ""}
    `,
    undefined,
    undefined,
    data.locale
  );
}

// ─── DOCUMENTS READY ────────────────────────────────────────────────────────

export type DocumentsReadyData = {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  documentTypes: string[];
  supportEmail: string | null;
  portalUrl?: string;
  locale: EmailLocale;
};

export function documentsReadyEmail(data: DocumentsReadyData): string {
  const t = emailCopy(data.locale);
  const c = t.documentsReady;
  const docList = data.documentTypes
    .map(
      (dt) =>
        (c.typeNames as Record<string, string>)[dt] ??
        dt.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())
    )
    .join(c.listAnd);
  const plural = data.documentTypes.length > 1;

  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">${esc(c.heading)}</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      ${esc(c.intro(data.customerFirstName, docList, data.orderNumber, plural))}
    </p>

    ${data.portalUrl ? `<p style="margin:20px 0;">
      <a href="${esc(data.portalUrl)}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;display:inline-block;">
        ${esc(c.button)}
      </a>
    </p>` : ""}

    <p style="font-size:14px;">
      ${data.supportEmail ? esc(t.questions.contactAt(data.supportEmail)) : ""}
    </p>
    `,
    undefined,
    undefined,
    data.locale
  );
}

// ─── EVENT REMINDER (day-before, customer-facing) ──────────────────────────

export type EventReminderData = {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  productName: string;
  eventDate: string;
  deliveryTime?: string;
  deliveryAddress?: string;
  setupInstructions?: string;
  supportEmail: string | null;
  locale: EmailLocale;
};

export function eventReminderEmail(data: EventReminderData): string {
  const t = emailCopy(data.locale);
  const c = t.eventReminder;
  const rows: [string, string][] = [
    [t.labels.order, `#${data.orderNumber}`],
    [t.labels.item, data.productName],
    [t.labels.eventDate, data.eventDate],
  ];

  if (data.deliveryTime) rows.push([t.labels.deliveryTime, data.deliveryTime]);
  if (data.deliveryAddress) rows.push([t.labels.address, data.deliveryAddress]);

  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">${esc(c.heading)}</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      ${esc(c.intro(data.customerFirstName))}
    </p>

    ${detailTable(rows)}

    ${data.setupInstructions
      ? `<div style="background:#f0f6ff;border:1px solid #c4d8f4;border-radius:12px;padding:16px;margin:20px 0;">
          <strong style="color:#1e5dcf;">${esc(c.setupNotesTitle)}</strong>
          <p style="margin:8px 0 0;font-size:14px;color:#10233f;">${esc(data.setupInstructions).replace(/\n/g, "<br />")}</p>
        </div>`
      : ""
    }

    <p style="font-size:14px;color:#55708f;">
      ${esc(c.accessNote)}
    </p>
    ${data.supportEmail ? `<p style="font-size:14px;color:#55708f;">
      ${esc(t.questions.contactAt(data.supportEmail))}
    </p>` : ""}
    `,
    undefined,
    undefined,
    data.locale
  );
}

// ─── DAILY SCHEDULE DIGEST (operator-facing) ───────────────────────────────

export type DailyScheduleEvent = {
  orderNumber: string;
  customerName: string;
  productName: string;
  address?: string;
  time?: string;
  status: string;
};

export type DailyScheduleData = {
  businessName: string;
  date: string;
  events: DailyScheduleEvent[];
  dashboardUrl: string;
};

export function dailyScheduleEmail(data: DailyScheduleData): string {
  const eventRows = data.events
    .map(
      (e) => `
      <tr style="border-bottom:1px solid #f0f3f8;">
        <td style="padding:12px 8px;font-size:14px;font-weight:600;">#${esc(e.orderNumber)}</td>
        <td style="padding:12px 8px;font-size:14px;">${esc(e.customerName)}</td>
        <td style="padding:12px 8px;font-size:14px;">${esc(e.productName)}</td>
        <td style="padding:12px 8px;font-size:14px;color:#55708f;">${esc(e.time ?? "TBD")}</td>
        <td style="padding:12px 8px;font-size:14px;">
          <span style="background:#eaf9f4;color:#188862;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;">
            ${esc(e.status.replace(/_/g, " "))}
          </span>
        </td>
      </tr>
    `
    )
    .join("");

  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">Today&rsquo;s Schedule</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      You have <strong>${data.events.length}</strong> event${data.events.length === 1 ? "" : "s"} on <strong>${esc(data.date)}</strong>.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border:1px solid #dbe6f4;border-radius:12px;overflow:hidden;">
      <tr style="background:#f4f7fb;">
        <th style="padding:10px 8px;font-size:12px;color:#55708f;text-align:left;">Order</th>
        <th style="padding:10px 8px;font-size:12px;color:#55708f;text-align:left;">Customer</th>
        <th style="padding:10px 8px;font-size:12px;color:#55708f;text-align:left;">Item</th>
        <th style="padding:10px 8px;font-size:12px;color:#55708f;text-align:left;">Time</th>
        <th style="padding:10px 8px;font-size:12px;color:#55708f;text-align:left;">Status</th>
      </tr>
      ${eventRows}
    </table>

    ${button("View Deliveries", data.dashboardUrl)}
    `
  );
}

// ─── POST-EVENT FOLLOW-UP (customer-facing) ────────────────────────────────

export type PostEventFollowUpData = {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  productName: string;
  eventDate: string;
  reviewUrl?: string;
  storefrontUrl: string;
  supportEmail: string | null;
  locale: EmailLocale;
};

export function postEventFollowUpEmail(data: PostEventFollowUpData): string {
  const t = emailCopy(data.locale);
  const c = t.postEventFollowUp;
  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">${esc(c.heading)}</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      ${esc(c.intro(data.customerFirstName, data.eventDate, data.businessName))}
    </p>

    ${detailTable([
      [t.labels.order, `#${data.orderNumber}`],
      [t.labels.item, data.productName],
      [t.labels.eventDate, data.eventDate],
    ])}

    ${data.reviewUrl
      ? `<div style="background:#fff9e6;border:1px solid #fde2a7;border-radius:12px;padding:16px;margin:20px 0;text-align:center;">
          <strong style="color:#a86a08;">${esc(c.reviewCallout)}</strong>
          <p style="margin:12px 0 0;">
            ${button(c.reviewButton, data.reviewUrl)}
          </p>
        </div>`
      : ""
    }

    <div style="text-align:center;margin:24px 0;">
      <p style="font-size:16px;font-weight:600;margin:0 0 8px;">${esc(c.bookAgainPrompt)}</p>
      ${button(c.bookAgainButton, data.storefrontUrl)}
    </div>

    ${data.supportEmail ? `<p style="font-size:14px;color:#55708f;">
      ${esc(t.questions.feedbackContactAt(data.supportEmail))}
    </p>` : ""}
    `,
    undefined,
    undefined,
    data.locale
  );
}

export function quoteSentEmail(data: {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  eventDate: string;
  total: string;
  depositRequired: string;
  portalUrl: string;
  supportEmail: string | null;
  locale: EmailLocale;
}): string {
  const t = emailCopy(data.locale);
  const c = t.quoteSent;
  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">${esc(c.heading)}</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      ${esc(c.intro(data.customerFirstName))}
    </p>

    ${detailTable([
      [t.labels.order, `#${data.orderNumber}`],
      [t.labels.eventDate, data.eventDate],
      [t.labels.total, data.total],
      [t.labels.depositToConfirm, data.depositRequired],
    ])}

    <div style="text-align:center;margin:28px 0;">
      ${button(c.button, data.portalUrl)}
    </div>

    <p style="font-size:13px;color:#55708f;text-align:center;">
      ${esc(c.disclaimer)}${data.supportEmail ? `<br>
      ${esc(t.questions.contactAt(data.supportEmail))}` : ""}
    </p>
    `,
    undefined,
    undefined,
    data.locale
  );
}

// ─── DEPOSIT REMINDER (customer-facing) ────────────────────────────────────

export type DepositReminderData = {
  businessName: string;
  customerFirstName: string;
  orderNumber: string;
  productName: string;
  eventDate: string;
  depositDue: string;
  portalUrl: string;
  supportEmail: string | null;
  locale: EmailLocale;
};

export function depositReminderEmail(data: DepositReminderData): string {
  const t = emailCopy(data.locale);
  const c = t.depositReminder;
  return layout(
    data.businessName,
    `
    <h1 style="margin:0 0 8px;font-size:24px;">${esc(c.heading)}</h1>
    <p style="color:#55708f;margin:0 0 20px;">
      ${esc(c.intro(data.customerFirstName))}
    </p>

    ${detailTable([
      [t.labels.order, `#${data.orderNumber}`],
      [t.labels.item, data.productName],
      [t.labels.eventDate, data.eventDate],
      [t.labels.depositDue, data.depositDue],
    ])}

    ${button(c.button, data.portalUrl)}

    ${data.supportEmail
      ? `<p style="font-size:14px;color:#55708f;">
          ${esc(t.questions.contactAt(data.supportEmail))}
        </p>`
      : ""}
    `,
    undefined,
    c.preheader(data.depositDue, data.orderNumber),
    data.locale
  );
}
