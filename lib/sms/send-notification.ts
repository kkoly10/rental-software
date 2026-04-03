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

  // Build message from template
  const templateFn = smsTemplates[type] as (...args: string[]) => string;
  const args = Object.values(params);
  let body = templateFn(...args);

  // Append signature if set
  if (settings.signature) {
    body = `${body}\n- ${settings.signature}`;
  }

  const result = await sendSms({ to: customerPhone, body });

  if (!result.ok) {
    console.error(`[SMS] Failed to send ${type} to ${customerPhone}:`, result.error);
  }

  // Log to communication_log
  if (organizationId) {
    logCommunication({
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
