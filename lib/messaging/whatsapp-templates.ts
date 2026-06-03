import { getOptionalEnv } from "../env.ts";

/**
 * WhatsApp Content Template registry (Sprint 4).
 *
 * Templates live in two places:
 *   1. Meta Business Manager — operator (or Korent team) submits a
 *      template for approval. Each approved template gets a unique
 *      ContentSid in Twilio. The ContentSid is the only way to fire
 *      a proactive WhatsApp message outside the 24h conversation
 *      window, so without approval there's no auto-sync.
 *
 *   2. This module — maps Korent's internal template keys to the
 *      ContentSid env vars. Centralized so the rest of the codebase
 *      references templates by semantic name (`orderConfirmation`)
 *      rather than fragile SIDs.
 *
 * The variable shape (`buildVariables`) is what each template needs
 * filled in. Twilio template variables are positional (1-indexed); we
 * keep them as named inputs for caller-side clarity, then translate
 * to the indexed shape Twilio wants.
 *
 * If a template's ContentSid env var isn't set, the dispatcher falls
 * back to SMS for that notification type — keeps the deploy quiet
 * when an org is still waiting on Meta approval.
 */

export type WhatsAppTemplateKey =
  | "orderConfirmation"
  | "depositReminder"
  | "deliveryScheduled"
  | "deliveryEnRoute"
  | "deliveryCompleted"
  | "weatherAlert"
  | "paymentReceived";

const ENV_VAR_BY_KEY: Record<WhatsAppTemplateKey, string> = {
  orderConfirmation: "WHATSAPP_TEMPLATE_ORDER_CONFIRMATION",
  depositReminder: "WHATSAPP_TEMPLATE_DEPOSIT_REMINDER",
  deliveryScheduled: "WHATSAPP_TEMPLATE_DELIVERY_SCHEDULED",
  deliveryEnRoute: "WHATSAPP_TEMPLATE_DELIVERY_EN_ROUTE",
  deliveryCompleted: "WHATSAPP_TEMPLATE_DELIVERY_COMPLETED",
  weatherAlert: "WHATSAPP_TEMPLATE_WEATHER_ALERT",
  paymentReceived: "WHATSAPP_TEMPLATE_PAYMENT_RECEIVED",
};

export function getWhatsAppContentSid(
  key: WhatsAppTemplateKey,
): string | undefined {
  return getOptionalEnv(ENV_VAR_BY_KEY[key]);
}

/**
 * Convert the caller's named template params into Twilio's 1-indexed
 * content-variables shape. Each template defines its own order; we
 * keep that mapping here so a future template-rev only touches this
 * module instead of every call site.
 *
 * Templates and their variable order (must match the Meta-approved
 * body verbatim; the comment after each entry is the Meta template
 * body for reference — keep in sync when re-submitting templates):
 *
 *   orderConfirmation   {{1}} = businessName, {{2}} = orderNumber
 *     "Hi from {{1}}! Your booking {{2}} is confirmed. We'll be in touch with delivery details."
 *
 *   depositReminder     {{1}} = businessName, {{2}} = orderNumber, {{3}} = amount
 *     "Reminder from {{1}}: a {{3}} deposit is due to confirm booking {{2}}."
 *
 *   deliveryScheduled   {{1}} = businessName, {{2}} = orderNumber, {{3}} = date, {{4}} = timeWindow
 *     "{{1}} delivery for {{2}} is scheduled for {{3}}, {{4}}."
 *
 *   deliveryEnRoute     {{1}} = businessName, {{2}} = orderNumber, {{3}} = eta, {{4}} = trackingUrl
 *     "{{1}} is on the way with your order {{2}}. ETA {{3}}. Track: {{4}}"
 *
 *   deliveryCompleted   {{1}} = businessName, {{2}} = orderNumber
 *     "Your delivery for {{2}} from {{1}} is complete. Thanks for choosing us!"
 *
 *   weatherAlert        {{1}} = businessName, {{2}} = orderNumber, {{3}} = forecast
 *     "Weather update for your {{1}} booking {{2}}: {{3}}. Reply with any concerns."
 *
 *   paymentReceived     {{1}} = businessName, {{2}} = orderNumber, {{3}} = amount
 *     "Payment of {{3}} received for {{2}}. Thanks from {{1}}!"
 */
export function buildVariables(
  key: WhatsAppTemplateKey,
  params: Record<string, string>,
): Record<string, string> {
  const fill = (...keys: string[]): Record<string, string> => {
    const out: Record<string, string> = {};
    keys.forEach((k, idx) => {
      out[String(idx + 1)] = params[k] ?? "";
    });
    return out;
  };

  switch (key) {
    case "orderConfirmation":
      return fill("businessName", "orderNumber");
    case "depositReminder":
      return fill("businessName", "orderNumber", "amount");
    case "deliveryScheduled":
      return fill("businessName", "orderNumber", "date", "timeWindow");
    case "deliveryEnRoute":
      return fill("businessName", "orderNumber", "eta", "trackingUrl");
    case "deliveryCompleted":
      return fill("businessName", "orderNumber");
    case "weatherAlert":
      return fill("businessName", "orderNumber", "forecast");
    case "paymentReceived":
      return fill("businessName", "orderNumber", "amount");
  }
}
