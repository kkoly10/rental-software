import { getSmsSettings } from "@/lib/data/sms-settings";
import { smsTemplates, renderSmsTemplate, type SmsTemplateKey } from "@/lib/sms/templates";
import { sendSms } from "@/lib/sms/provider";
import { logCommunication } from "@/lib/communications/log";
import type { WhatsAppTemplateKey } from "@/lib/messaging/whatsapp-templates";

type TemplateKey = SmsTemplateKey;

// Sprint 4 — SMS template keys that have a parallel WhatsApp template.
// `paymentReceived` and `weatherAlert` are SMS-only for now (no
// WhatsApp templates for them in the initial Meta submission); they
// default to SMS regardless of whatsapp_opted_in.
const WHATSAPP_ELIGIBLE_KEYS: TemplateKey[] = [
  "orderConfirmation",
  "depositReminder",
  "deliveryScheduled",
  "deliveryEnRoute",
  "deliveryCompleted",
];

function isWhatsAppTemplateKey(key: TemplateKey): key is WhatsAppTemplateKey & TemplateKey {
  return WHATSAPP_ELIGIBLE_KEYS.includes(key);
}

const settingsMap: Record<TemplateKey, keyof Awaited<ReturnType<typeof getSmsSettings>>> = {
  orderConfirmation: "orderConfirmation",
  depositReminder: "depositReminder",
  deliveryScheduled: "deliveryUpdates",
  deliveryEnRoute: "deliveryUpdates",
  deliveryCompleted: "deliveryUpdates",
  weatherAlert: "weatherAlerts",
  paymentReceived: "paymentConfirmation",
  orderCancelled: "orderConfirmation",
};

export async function sendSmsNotification(
  type: TemplateKey,
  customerPhone: string,
  params: Record<string, string>,
  organizationId?: string,
  context?: { orderId?: string; customerId?: string }
): Promise<void> {
  if (!customerPhone?.trim()) return;

  const settings = await getSmsSettings(organizationId);

  if (!settings.enabled) {
    return;
  }

  // SMS/WhatsApp is a paid-tier capability (Twilio + carrier A2P cost).
  // Enforce by org id here — this dispatch runs from crons too, where
  // there's no auth context for the usual checkFeatureAccess() path.
  if (organizationId) {
    const { orgPlanAllowsSms } = await import("@/lib/stripe/subscription");
    if (!(await orgPlanAllowsSms(organizationId))) {
      return;
    }
  }

  const settingKey = settingsMap[type];
  if (settingKey && !settings[settingKey]) {
    return;
  }

  // Check customer-level SMS opt-in (TCPA compliance) and resolve the
  // customer's preferred locale in the same query so we send the body in
  // their language. Falls back to "en" when the column is null or the
  // lookup fails. Sprint 4 also pulls whatsapp_opted_in + whatsapp_number
  // here so the dispatcher below can pick the right channel.
  let customerLocale = "en";
  let whatsappOptedIn = false;
  let whatsappNumber: string | null = null;
  if (context?.customerId && organizationId) {
    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();
      const { data: customer } = await supabase
        .from("customers")
        .select("sms_opt_in, preferred_locale, whatsapp_opted_in, whatsapp_number")
        .eq("id", context.customerId)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .maybeSingle();
      if (customer && !customer.sms_opt_in) {
        return;
      }
      const row = customer as
        | {
            preferred_locale?: string | null;
            whatsapp_opted_in?: boolean | null;
            whatsapp_number?: string | null;
          }
        | null;
      const candidate = row?.preferred_locale;
      if (candidate && ["en", "fr", "es", "pt"].includes(candidate)) {
        customerLocale = candidate;
      } else if (candidate) {
        // Customer asked for a locale we don't ship templates in. Fall back
        // to English (the existing default at line 61) but flag it so the
        // operator notices — silent degradation means a Spanish-speaking
        // customer keeps receiving English texts and no one knows why.
        console.warn(
          `[sms] unsupported customer locale "${candidate}" — falling back to English. customer=${context?.customerId} org=${organizationId}`,
        );
      }
      whatsappOptedIn = Boolean(row?.whatsapp_opted_in);
      whatsappNumber = row?.whatsapp_number ?? null;
    } catch {
      // If we can't confirm opt-in, don't send
      return;
    }
  }

  // Render in the customer's preferred locale; the legacy
  // `smsTemplates[type](params)` adapter would always render in English.
  let body = renderSmsTemplate(
    type,
    params as Record<string, string | undefined>,
    customerLocale
  );
  // `smsTemplates` is intentionally referenced so the legacy adapter stays
  // exported for anything still importing it directly.
  void smsTemplates;

  // Append signature if set
  if (settings.signature) {
    body = `${body}\n- ${settings.signature}`;
  }

  const result = await (async () => {
    // Sprint 4 — try WhatsApp first when conditions match, fall back to
    // SMS. dispatchCustomerMessage encapsulates the decision tree and
    // surfaces which channel actually delivered so we can log it
    // accurately below.
    if (
      organizationId &&
      whatsappOptedIn &&
      isWhatsAppTemplateKey(type)
    ) {
      const { dispatchCustomerMessage } = await import(
        "@/lib/messaging/dispatch"
      );
      const { createSupabaseServerClient } = await import(
        "@/lib/supabase/server"
      );
      const supabase = await createSupabaseServerClient();
      return dispatchCustomerMessage(supabase, organizationId, {
        templateKey: type as WhatsAppTemplateKey,
        smsBody: body,
        phone: customerPhone,
        customerWhatsappOptedIn: whatsappOptedIn,
        customerWhatsappNumber: whatsappNumber,
        params: params as Record<string, string>,
      });
    }
    const r = await sendSms({ to: customerPhone, body });
    return {
      channel: r.ok ? ("sms" as const) : ("none" as const),
      ok: r.ok,
      messageId: r.messageId,
      error: r.error,
    };
  })();

  if (!result.ok) {
    const redacted = `***-***-${customerPhone.slice(-4)}`;
    console.error(`[SMS] Failed to send ${type} to ${redacted}:`, result.error);
  }

  // Log to communication_log — must be awaited; fire-and-forget is killed by Lambda
  if (organizationId) {
    await logCommunication({
      organizationId,
      orderId: context?.orderId,
      customerId: context?.customerId,
      // Sprint 4 — record which channel actually delivered so the
      // operator's comm log surfaces "WhatsApp" vs "SMS" badges.
      channel: result.channel === "whatsapp" ? "whatsapp" : "sms",
      direction: "outbound",
      recipient: customerPhone,
      subject: type,
      bodyPreview: body,
      status: result.ok ? "sent" : "failed",
      metadata: result.ok
        ? { messageId: result.messageId, channel: result.channel }
        : { error: result.error, channel: result.channel },
    }).catch((err) => { console.error("[sms] Failed to log communication:", err instanceof Error ? err.message : err); });
  }
}
