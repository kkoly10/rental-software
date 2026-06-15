import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatMessage } from "@/lib/i18n/format";
import { resolveLocale, type Locale } from "@/lib/i18n/config";

/**
 * Build an SMS body for the given template + locale. Falls back to the
 * default locale (English) when the requested one is unknown. The hardcoded
 * "$" used by older inline templates was the only thing keeping deposit
 * and payment messages USD-only; callers now pass an already-formatted
 * `amount` so a JPY/EUR org sees the right symbol.
 */
export type SmsTemplateKey =
  | "orderConfirmation"
  | "depositReminder"
  | "deliveryScheduled"
  | "deliveryEnRoute"
  | "deliveryCompleted"
  | "weatherAlert"
  | "paymentReceived"
  | "orderCancelled";

export type SmsTemplateValues = Record<string, string | undefined>;

// Vertical-aware render keys: the general ("other") vertical swaps a few
// event-framed bodies for neutral copy. These render-only keys aren't part
// of SmsTemplateKey (which gates settings/WhatsApp eligibility by the
// original event key) — they're only ever passed to renderSmsTemplate.
export type SmsRenderKey = SmsTemplateKey | "deliveryCompletedGeneral";

export function renderSmsTemplate(
  key: SmsRenderKey,
  values: SmsTemplateValues,
  locale: Locale | string = "en"
): string {
  const resolved = resolveLocale(typeof locale === "string" ? locale : null);
  const messages = getDictionary(resolved);
  const dict = messages.sms;

  let template: string;
  if (key === "deliveryEnRoute" && values.trackingUrl) {
    template = dict.deliveryEnRouteWithTracking;
  } else {
    template = dict[key as keyof typeof dict];
  }

  // formatMessage tolerates undefined values by leaving the placeholder in
  // place; callers pass `undefined` for absent optional tokens so the user
  // never sees a literal "{trackingUrl}" in the message body.
  const filled: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined && v !== null) filled[k] = String(v);
  }
  return formatMessage(template, filled);
}

// Legacy export retained for callers that still inline the English
// templates directly (and for the per-key TypeScript narrowing). New
// callers should use `renderSmsTemplate` with an explicit locale.
export const smsTemplates = {
  orderConfirmation: (p: { orderNumber: string; businessName: string }) =>
    renderSmsTemplate("orderConfirmation", { orderNumber: p.orderNumber, businessName: p.businessName }),

  depositReminder: (p: { orderNumber: string; amount: string; businessName: string }) =>
    renderSmsTemplate("depositReminder", { orderNumber: p.orderNumber, amount: p.amount, businessName: p.businessName }),

  deliveryScheduled: (p: { orderNumber: string; date: string; timeWindow: string; businessName: string }) =>
    renderSmsTemplate("deliveryScheduled", {
      orderNumber: p.orderNumber,
      date: p.date,
      timeWindow: p.timeWindow,
      businessName: p.businessName,
    }),

  deliveryEnRoute: (p: { orderNumber: string; eta: string; businessName: string; trackingUrl?: string }) =>
    renderSmsTemplate("deliveryEnRoute", {
      orderNumber: p.orderNumber,
      eta: p.eta,
      businessName: p.businessName,
      trackingUrl: p.trackingUrl,
    }),

  deliveryCompleted: (p: { orderNumber: string; businessName: string }) =>
    renderSmsTemplate("deliveryCompleted", { orderNumber: p.orderNumber, businessName: p.businessName }),

  weatherAlert: (p: { orderNumber: string; date: string; businessName: string }) =>
    renderSmsTemplate("weatherAlert", { orderNumber: p.orderNumber, date: p.date, businessName: p.businessName }),

  paymentReceived: (p: { amount: string; orderNumber: string; businessName: string }) =>
    renderSmsTemplate("paymentReceived", { amount: p.amount, orderNumber: p.orderNumber, businessName: p.businessName }),

  orderCancelled: (p: { orderNumber: string; businessName: string }) =>
    renderSmsTemplate("orderCancelled", { orderNumber: p.orderNumber, businessName: p.businessName }),
};
