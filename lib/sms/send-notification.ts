import { getSmsSettings } from "@/lib/data/sms-settings";
import { smsTemplates } from "@/lib/sms/templates";
import { sendSms } from "@/lib/sms/provider";
import { logCommunication } from "@/lib/communications/log";

type TemplateKey = keyof typeof smsTemplates;

const settingsMap: Record<TemplateKey, keyof Awaited<ReturnType<typeof getSmsSettings>>> = {
  orderConfirmation: "orderConfirmation",
  depositReminder: "depositReminder",
  deliveryScheduled: "deliveryUpdates",
  deliveryEnRoute: "deliveryUpdates",
  deliveryCompleted: "deliveryUpdates",
  weatherAlert: "weatherAlerts",
  paymentReceived: "paymentConfirmation",
};

export async function sendSmsNotification(
  type: TemplateKey,
  customerPhone: string,
  params: Record<string, string>,
  organizationId?: string,
  context?: { orderId?: string; customerId?: string }
): Promise<void> {
  const settings = await getSmsSettings(organizationId);

  if (!settings.enabled) {
    return;
  }

  const settingKey = settingsMap[type];
  if (settingKey && !settings[settingKey]) {
    return;
  }

  // Check customer-level SMS opt-in (TCPA compliance)
  if (context?.customerId && organizationId) {
    try {
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();
      const { data: customer } = await supabase
        .from("customers")
        .select("sms_opt_in")
        .eq("id", context.customerId)
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (customer && !customer.sms_opt_in) {
        return;
      }
    } catch {
      // If we can't confirm opt-in, don't send
      return;
    }
  }

  // Build message from template
  const templateFn = smsTemplates[type] as (p: Record<string, string | undefined>) => string;
  let body = templateFn(params);

  // Append signature if set
  if (settings.signature) {
    body = `${body}\n- ${settings.signature}`;
  }

  const result = await sendSms({ to: customerPhone, body });

  if (!result.ok) {
    console.error(`[SMS] Failed to send ${type} to ${customerPhone}:`, result.error);
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
    }).catch(() => {});
  }
}
