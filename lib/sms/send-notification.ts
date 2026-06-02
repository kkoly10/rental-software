import { getSmsSettings } from "@/lib/data/sms-settings";
import { smsTemplates, renderSmsTemplate, type SmsTemplateKey } from "@/lib/sms/templates";
import { sendSms } from "@/lib/sms/provider";
import { logCommunication } from "@/lib/communications/log";

type TemplateKey = SmsTemplateKey;

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

  const settingKey = settingsMap[type];
  if (settingKey && !settings[settingKey]) {
    return;
  }

  // Check customer-level SMS opt-in (TCPA compliance) and resolve the
  // customer's preferred locale in the same query so we send the body in
  // their language. Falls back to "en" when the column is null or the
  // lookup fails.
  let customerLocale = "en";
  if (context?.customerId && organizationId) {
    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();
      const { data: customer } = await supabase
        .from("customers")
        .select("sms_opt_in, preferred_locale")
        .eq("id", context.customerId)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .maybeSingle();
      if (customer && !customer.sms_opt_in) {
        return;
      }
      const candidate = (customer as { preferred_locale?: string | null } | null)?.preferred_locale;
      if (candidate && ["en", "fr", "es", "pt"].includes(candidate)) {
        customerLocale = candidate;
      }
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

  const result = await sendSms({ to: customerPhone, body });

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
      channel: "sms",
      direction: "outbound",
      recipient: customerPhone,
      subject: type,
      bodyPreview: body,
      status: result.ok ? "sent" : "failed",
      metadata: result.ok ? { messageId: result.messageId } : { error: result.error },
    }).catch((err) => { console.error("[sms] Failed to log communication:", err instanceof Error ? err.message : err); });
  }
}
