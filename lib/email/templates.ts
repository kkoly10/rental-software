/**
 * Shared email layout + components — editorial skin.
 *
 * Matches the product's design language (storefront, marketing, dashboard,
 * PDF documents): warm paper background, ink-on-white with hairline rules,
 * a serif display face (Georgia — the web-safe serif every mail client
 * ships, so no font embedding) over a sans body, square-cornered buttons,
 * and left-rule callouts instead of filled rounded pills. The corporate
 * blue gradient header band is gone.
 *
 * Brand accent: the operator's explicitly-set brand color drives the
 * letterhead edge bar and attention callouts. Operators who never
 * customized fall back to ink rather than the old platform blue — neutral,
 * timeless transactional mail beats branding every tenant in our color.
 *
 * All styles are inlined for maximum email-client compatibility.
 */

import { emailCopy, type EmailLocale } from "./email-i18n";

export type { EmailLocale } from "./email-i18n";

// ─── Editorial palette ─────────────────────────────────────────────────────
const BG = "#f7f4ee"; // warm paper
const CARD = "#ffffff";
const INK = "#1f1c17";
const MUTED = "#5c5651";
const FAINT = "#8a847c";
const HAIRLINE = "#e4ded3";
const RULE = "#cfc7b7";
const SUCCESS = "#3f5530";
const SUCCESS_BG = "#eef2e6";
const ATTENTION = "#9a3412"; // warm burnt — never a saturated alert red
const ATTENTION_BG = "#f7ede3";
const NOTE_BG = "#f3f0e9";
const SERIF = "Georgia, 'Times New Roman', Times, serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

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

/**
 * Resolve the operator's brand color into a safe accent hex, or fall back
 * to ink. Validates strictly (3- or 6-digit hex only) so the value is safe
 * to interpolate into a style attribute, and treats the legacy platform
 * default (#1e5dcf) as "never customized" → ink.
 */
export function emailAccent(brandColor?: string | null): string {
  if (!brandColor) return INK;
  const v = brandColor.trim().toLowerCase();
  if (v === "#1e5dcf") return INK;
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(v) ? v : INK;
}

function layout(
  businessName: string,
  body: string,
  footer?: string,
  preheader?: string,
  locale: EmailLocale = "en",
  accent: string = INK
): string {
  const safeName = esc(businessName);
  const preheaderSpan = preheader
    ? `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${esc(preheader)}</span>`
    : "";
  return `<!DOCTYPE html>
<html lang="${esc(locale)}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${BG};font-family:${SANS};color:${INK};line-height:1.6;">
  ${preheaderSpan}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:${CARD};border:1px solid ${HAIRLINE};border-radius:3px;overflow:hidden;max-width:600px;width:100%;">
        <!-- Letterhead edge -->
        <tr><td style="height:3px;line-height:3px;font-size:0;background:${accent};">&nbsp;</td></tr>
        <!-- Header -->
        <tr>
          <td style="padding:30px 40px 0;">
            <span style="font-family:${SERIF};font-size:22px;font-weight:bold;color:${INK};letter-spacing:0.01em;">${safeName}</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:24px 40px 36px;">
            ${body}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:22px 40px;border-top:1px solid ${HAIRLINE};color:${FAINT};font-size:12px;">
            ${footer ?? `<p style="margin:0;">Sent by ${safeName}</p>`}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Re-exported under prefixed names so other modules (team invites,
// onboarding welcome) compose editorial emails on the same chrome instead
// of hand-rolling the old blue HTML.
export {
  esc as escapeEmailHtml,
  layout as renderEmailLayout,
  button as emailButton,
  heading as emailHeading,
  lead as emailLead,
  detailTable as emailDetailTable,
  callout as emailCallout,
};

/** Serif display heading. Pass raw text — escaped internally. */
function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-family:${SERIF};font-size:25px;font-weight:normal;line-height:1.22;color:${INK};">${esc(text)}</h1>`;
}

/** Muted lede paragraph under the heading. Pass raw text — escaped. */
function lead(text: string): string {
  return `<p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:${MUTED};">${esc(text)}</p>`;
}

/** Ink-filled square CTA. Ink (not the brand accent) so the label stays
 *  legible at any operator brand color. */
function button(text: string, url: string): string {
  return `<a href="${esc(url)}" style="display:inline-block;padding:13px 30px;margin:8px 0;background:${INK};color:#fdfaf5;border-radius:2px;font-weight:600;font-size:14px;letter-spacing:0.02em;text-decoration:none;">${esc(text)}</a>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:11px 0;border-bottom:1px solid ${HAIRLINE};font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${FAINT};width:44%;vertical-align:top;">${esc(label)}</td>
    <td style="padding:11px 0;border-bottom:1px solid ${HAIRLINE};font-size:14px;color:${INK};text-align:right;vertical-align:top;">${esc(value)}</td>
  </tr>`;
}

function detailTable(rows: [string, string][]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;border-top:1px solid ${RULE};">
    ${rows.map(([label, value]) => detailRow(label, value)).join("")}
  </table>`;
}

type CalloutTone = "positive" | "attention" | "note";

/** Left-rule callout — replaces the old filled rounded pill boxes. Title
 *  and body are pre-escaped HTML supplied by the caller. */
function callout(
  tone: CalloutTone,
  titleHtml: string,
  bodyHtml: string,
  accent: string = INK,
  align: "left" | "center" = "left"
): string {
  const text = tone === "positive" ? SUCCESS : tone === "attention" ? ATTENTION : INK;
  const bg = tone === "positive" ? SUCCESS_BG : tone === "attention" ? ATTENTION_BG : NOTE_BG;
  const bar = tone === "positive" ? SUCCESS : tone === "attention" ? (accent !== INK ? accent : ATTENTION) : RULE;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:20px 0;">
    <tr><td style="border-left:3px solid ${bar};background:${bg};padding:15px 18px;text-align:${align};">
      <strong style="font-size:14px;color:${text};">${titleHtml}</strong>
      ${bodyHtml ? `<p style="margin:7px 0 0;font-size:13px;line-height:1.6;color:${text};">${bodyHtml}</p>` : ""}
    </td></tr>
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
  brandColor?: string | null;
};

export function orderConfirmationEmail(data: OrderConfirmationData): string {
  const t = emailCopy(data.locale);
  const c = t.orderConfirmation;
  const accent = emailAccent(data.brandColor);
  return layout(
    data.businessName,
    `
    ${heading(c.heading)}
    ${lead(c.intro(data.customerFirstName))}

    ${detailTable([
      [t.labels.order, `#${data.orderNumber}`],
      [t.labels.item, data.productName],
      [t.labels.eventDate, data.eventDate],
      [t.labels.subtotal, data.subtotal],
      [t.labels.deliveryFee, data.deliveryFee],
      [t.labels.total, data.total],
    ])}

    ${callout("attention", esc(c.depositRequired(data.depositDue)), esc(c.depositInstructions), accent)}

    ${button(c.button, data.portalUrl)}

    <p style="font-size:14px;color:${MUTED};">
      ${esc(t.questions.replyOrContact(data.supportEmail))}
    </p>
    `,
    undefined,
    undefined,
    data.locale,
    accent
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
  brandColor?: string | null;
};

export function newOrderAlertEmail(data: NewOrderAlertData): string {
  return layout(
    data.businessName,
    `
    ${heading("New order received")}
    ${lead(`A new booking came in from your ${data.source === "website" ? "website" : "dashboard"}.`)}

    ${detailTable([
      ["Order", `#${data.orderNumber}`],
      ["Customer", data.customerName],
      ["Email", data.customerEmail],
      ["Item", data.productName],
      ["Event date", data.eventDate],
      ["Total", data.total],
    ])}

    ${button("View Order", data.dashboardUrl)}
    `,
    undefined,
    undefined,
    "en",
    emailAccent(data.brandColor)
  );
}

// ─── OPERATOR ACTIVITY ALERT (customer-initiated events) ──────────────────

export type OperatorActivityEvent =
  | "payment_received"
  | "document_signed"
  | "quote_accepted"
  | "quote_requested"
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
  brandColor?: string | null;
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
  quote_requested: {
    headline: "Quote requested",
    lead: "A customer asked for a quote from your storefront — review the details and send your pricing.",
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
    ${heading(copy.headline)}
    ${lead(copy.lead)}

    ${detailTable(rows)}

    ${button("Open order", data.dashboardUrl)}
    `,
    undefined,
    undefined,
    "en",
    emailAccent(data.brandColor)
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
  brandColor?: string | null;
};

export function paymentReceivedEmail(data: PaymentReceivedData): string {
  const isFullyPaid = data.fullyPaid ?? data.newBalance === "$0.00";
  const t = emailCopy(data.locale);
  const c = t.paymentReceived;

  return layout(
    data.businessName,
    `
    ${heading(c.heading)}
    ${lead(c.intro(data.customerFirstName, data.paymentType))}

    ${detailTable([
      [t.labels.order, `#${data.orderNumber}`],
      [t.labels.amount, data.amount],
      [t.labels.method, data.paymentMethod],
      [t.labels.balanceRemaining, data.newBalance],
    ])}

    ${isFullyPaid
      ? callout("positive", esc(c.fullyPaidTitle), esc(c.fullyPaidBody))
      : `<p style="font-size:14px;color:${MUTED};">
          ${esc(c.balanceDue(data.newBalance))}
        </p>`
    }

    ${data.supportEmail ? `<p style="font-size:14px;color:${MUTED};">
      ${esc(t.questions.contactAt(data.supportEmail))}
    </p>` : ""}
    `,
    undefined,
    undefined,
    data.locale,
    emailAccent(data.brandColor)
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
  brandColor?: string | null;
};

export function refundProcessedEmail(data: RefundProcessedData): string {
  const t = emailCopy(data.locale);
  const c = t.refundProcessed;
  return layout(
    data.businessName,
    `
    ${heading(c.heading)}
    ${lead(c.intro(data.customerFirstName))}

    ${detailTable([
      [t.labels.order, `#${data.orderNumber}`],
      [t.labels.refundAmount, data.amount],
    ])}

    <p style="font-size:14px;color:${MUTED};">
      ${esc(c.timing)}${data.supportEmail ? esc(c.contactSuffix(data.supportEmail)) : ""}
    </p>
    `,
    undefined,
    undefined,
    data.locale,
    emailAccent(data.brandColor)
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
  brandColor?: string | null;
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
    ${heading(msg.heading)}
    ${lead(c.intro(data.customerFirstName))}

    ${detailTable(rows)}

    <p style="font-size:14px;margin:16px 0;color:${INK};">${esc(msg.body)}</p>

    ${data.portalUrl ? button(c.button, data.portalUrl) : ""}

    ${data.supportEmail ? `<p style="font-size:14px;color:${MUTED};">
      ${esc(t.questions.contactAt(data.supportEmail))}
    </p>` : ""}
    `,
    undefined,
    undefined,
    data.locale,
    emailAccent(data.brandColor)
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
  brandColor?: string | null;
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
    ${heading(c.heading)}
    ${lead(c.intro(data.customerFirstName, docList, data.orderNumber, plural))}

    ${data.portalUrl ? button(c.button, data.portalUrl) : ""}

    <p style="font-size:14px;color:${MUTED};">
      ${data.supportEmail ? esc(t.questions.contactAt(data.supportEmail)) : ""}
    </p>
    `,
    undefined,
    undefined,
    data.locale,
    emailAccent(data.brandColor)
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
  brandColor?: string | null;
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
    ${heading(c.heading)}
    ${lead(c.intro(data.customerFirstName))}

    ${detailTable(rows)}

    ${data.setupInstructions
      ? callout("note", esc(c.setupNotesTitle), esc(data.setupInstructions).replace(/\n/g, "<br />"))
      : ""
    }

    <p style="font-size:14px;color:${MUTED};">
      ${esc(c.accessNote)}
    </p>
    ${data.supportEmail ? `<p style="font-size:14px;color:${MUTED};">
      ${esc(t.questions.contactAt(data.supportEmail))}
    </p>` : ""}
    `,
    undefined,
    undefined,
    data.locale,
    emailAccent(data.brandColor)
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
  brandColor?: string | null;
};

export function dailyScheduleEmail(data: DailyScheduleData): string {
  const eventRows = data.events
    .map(
      (e, i) => `
      <tr>
        <td style="padding:13px 8px 13px 0;font-size:14px;font-weight:600;color:${INK};border-top:${i === 0 ? "0" : `1px solid ${HAIRLINE}`};">#${esc(e.orderNumber)}</td>
        <td style="padding:13px 8px;font-size:14px;color:${INK};border-top:${i === 0 ? "0" : `1px solid ${HAIRLINE}`};">${esc(e.customerName)}</td>
        <td style="padding:13px 8px;font-size:14px;color:${MUTED};border-top:${i === 0 ? "0" : `1px solid ${HAIRLINE}`};">${esc(e.productName)}</td>
        <td style="padding:13px 8px;font-size:14px;color:${MUTED};border-top:${i === 0 ? "0" : `1px solid ${HAIRLINE}`};">${esc(e.time ?? "TBD")}</td>
        <td style="padding:13px 0 13px 8px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${FAINT};text-align:right;border-top:${i === 0 ? "0" : `1px solid ${HAIRLINE}`};">${esc(e.status.replace(/_/g, " "))}</td>
      </tr>
    `
    )
    .join("");

  return layout(
    data.businessName,
    `
    ${heading("Today’s Schedule")}
    <p style="margin:0 0 22px;font-size:15px;line-height:1.65;color:${MUTED};">
      You have <strong style="color:${INK};">${data.events.length}</strong> event${data.events.length === 1 ? "" : "s"} on <strong style="color:${INK};">${esc(data.date)}</strong>.
    </p>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0;border-top:1px solid ${RULE};">
      <tr>
        <th style="padding:10px 8px 10px 0;font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${FAINT};text-align:left;border-bottom:1px solid ${HAIRLINE};">Order</th>
        <th style="padding:10px 8px;font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${FAINT};text-align:left;border-bottom:1px solid ${HAIRLINE};">Customer</th>
        <th style="padding:10px 8px;font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${FAINT};text-align:left;border-bottom:1px solid ${HAIRLINE};">Item</th>
        <th style="padding:10px 8px;font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${FAINT};text-align:left;border-bottom:1px solid ${HAIRLINE};">Time</th>
        <th style="padding:10px 0 10px 8px;font-size:11px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;color:${FAINT};text-align:right;border-bottom:1px solid ${HAIRLINE};">Status</th>
      </tr>
      ${eventRows}
    </table>

    ${button("View Deliveries", data.dashboardUrl)}
    `,
    undefined,
    undefined,
    "en",
    emailAccent(data.brandColor)
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
  brandColor?: string | null;
};

export function postEventFollowUpEmail(data: PostEventFollowUpData): string {
  const t = emailCopy(data.locale);
  const c = t.postEventFollowUp;
  const accent = emailAccent(data.brandColor);
  return layout(
    data.businessName,
    `
    ${heading(c.heading)}
    ${lead(c.intro(data.customerFirstName, data.eventDate, data.businessName))}

    ${detailTable([
      [t.labels.order, `#${data.orderNumber}`],
      [t.labels.item, data.productName],
      [t.labels.eventDate, data.eventDate],
    ])}

    ${data.reviewUrl
      ? callout("attention", esc(c.reviewCallout), button(c.reviewButton, data.reviewUrl), accent, "center")
      : ""
    }

    <div style="text-align:center;margin:28px 0;">
      <p style="font-family:${SERIF};font-size:18px;margin:0 0 10px;color:${INK};">${esc(c.bookAgainPrompt)}</p>
      ${button(c.bookAgainButton, data.storefrontUrl)}
    </div>

    ${data.supportEmail ? `<p style="font-size:14px;color:${MUTED};">
      ${esc(t.questions.feedbackContactAt(data.supportEmail))}
    </p>` : ""}
    `,
    undefined,
    undefined,
    data.locale,
    accent
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
  brandColor?: string | null;
}): string {
  const t = emailCopy(data.locale);
  const c = t.quoteSent;
  return layout(
    data.businessName,
    `
    ${heading(c.heading)}
    ${lead(c.intro(data.customerFirstName))}

    ${detailTable([
      [t.labels.order, `#${data.orderNumber}`],
      [t.labels.eventDate, data.eventDate],
      [t.labels.total, data.total],
      [t.labels.depositToConfirm, data.depositRequired],
    ])}

    <div style="text-align:center;margin:28px 0;">
      ${button(c.button, data.portalUrl)}
    </div>

    <p style="font-size:13px;color:${MUTED};text-align:center;">
      ${esc(c.disclaimer)}${data.supportEmail ? `<br>
      ${esc(t.questions.contactAt(data.supportEmail))}` : ""}
    </p>
    `,
    undefined,
    undefined,
    data.locale,
    emailAccent(data.brandColor)
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
  brandColor?: string | null;
};

export function depositReminderEmail(data: DepositReminderData): string {
  const t = emailCopy(data.locale);
  const c = t.depositReminder;
  return layout(
    data.businessName,
    `
    ${heading(c.heading)}
    ${lead(c.intro(data.customerFirstName))}

    ${detailTable([
      [t.labels.order, `#${data.orderNumber}`],
      [t.labels.item, data.productName],
      [t.labels.eventDate, data.eventDate],
      [t.labels.depositDue, data.depositDue],
    ])}

    ${button(c.button, data.portalUrl)}

    ${data.supportEmail
      ? `<p style="font-size:14px;color:${MUTED};">
          ${esc(t.questions.contactAt(data.supportEmail))}
        </p>`
      : ""}
    `,
    undefined,
    c.preheader(data.depositDue, data.orderNumber),
    data.locale,
    emailAccent(data.brandColor)
  );
}
