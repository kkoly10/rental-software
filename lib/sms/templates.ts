import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatMessage } from "@/lib/i18n/format";
import { resolveLocale, type Locale } from "@/lib/i18n/config";

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

/**
 * Build an SMS body for the given template + locale. Falls back to the
 * default locale (English) when the requested one is unknown.
 *
 * Companion to `customers.preferred_locale`: `sendSmsNotification` reads
 * that column and calls this with the resolved value so the customer
 * gets the SMS in their own language.
 */
export function renderSmsTemplate(
  key: SmsTemplateKey,
  values: SmsTemplateValues,
  locale: Locale | string = "en"
): string {
  const resolved = resolveLocale(typeof locale === "string" ? locale : null);
  const messages = getDictionary(resolved);
  const dict = (messages as { sms?: Record<string, string> }).sms ?? {};

  let template: string | undefined;
  if (key === "deliveryEnRoute" && values.trackingUrl) {
    template = dict.deliveryEnRouteWithTracking;
  } else {
    template = dict[key];
  }

  // If the dictionary doesn't carry the key yet (e.g. older deployment
  // with new SMS code but old translation bundle), fall back to the
  // English literal so the customer still gets *something* useful.
  if (!template) {
    template = ENGLISH_FALLBACK[key];
    if (key === "deliveryEnRoute" && values.trackingUrl) {
      template = ENGLISH_FALLBACK_WITH_TRACKING;
    }
  }

  const filled: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined && v !== null) filled[k] = String(v);
  }
  return formatMessage(template, filled);
}

const ENGLISH_FALLBACK: Record<SmsTemplateKey, string> = {
  orderConfirmation:
    "{businessName}: Order #{orderNumber} confirmed! We'll be in touch with delivery details. Reply STOP to unsubscribe.",
  depositReminder:
    "{businessName}: A {amount} deposit is due for order #{orderNumber}. Pay to secure your date. Reply STOP to opt out.",
  deliveryScheduled:
    "{businessName}: Order #{orderNumber} delivery on {date}, {timeWindow}. We'll notify you en route. Reply STOP to opt out.",
  deliveryEnRoute:
    "{businessName}: Crew is on the way for order #{orderNumber}! ETA: {eta}. Reply STOP to opt out.",
  deliveryCompleted:
    "{businessName}: Order #{orderNumber} delivered and set up. Enjoy your event! Reply STOP to opt out.",
  weatherAlert:
    "{businessName}: Weather alert for {date} may affect order #{orderNumber}. We'll contact you if changes are needed. Reply STOP to opt out.",
  paymentReceived:
    "{businessName}: Payment of {amount} received for order #{orderNumber}. Thank you! Reply STOP to opt out.",
  orderCancelled:
    "{businessName}: Order #{orderNumber} has been cancelled. Contact us with any questions. Reply STOP to opt out.",
};

const ENGLISH_FALLBACK_WITH_TRACKING =
  "{businessName}: Crew is on the way for order #{orderNumber}! ETA: {eta}. Track: {trackingUrl} Reply STOP to opt out.";

// Legacy default-English adapter for callers that still inline string
// interpolation rather than going through `renderSmsTemplate`.
export const smsTemplates = {
  orderConfirmation: (p: { orderNumber: string; businessName: string }) =>
    renderSmsTemplate("orderConfirmation", { orderNumber: p.orderNumber, businessName: p.businessName }),

  depositReminder: (p: { orderNumber: string; amount: string; businessName: string }) =>
    renderSmsTemplate("depositReminder", {
      orderNumber: p.orderNumber,
      amount: p.amount,
      businessName: p.businessName,
    }),

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
    renderSmsTemplate("paymentReceived", {
      amount: p.amount,
      orderNumber: p.orderNumber,
      businessName: p.businessName,
    }),

  orderCancelled: (p: { orderNumber: string; businessName: string }) =>
    renderSmsTemplate("orderCancelled", { orderNumber: p.orderNumber, businessName: p.businessName }),
};
