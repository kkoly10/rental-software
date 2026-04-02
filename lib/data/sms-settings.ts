import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type SmsSettings = {
  enabled: boolean;
  orderConfirmation: boolean;
  depositReminder: boolean;
  deliveryUpdates: boolean;
  paymentConfirmation: boolean;
  weatherAlerts: boolean;
  signature: string;
};

const defaultSettings: SmsSettings = {
  enabled: false,
  orderConfirmation: true,
  depositReminder: true,
  deliveryUpdates: true,
  paymentConfirmation: true,
  weatherAlerts: true,
  signature: "",
};

export async function getSmsSettings(organizationId?: string): Promise<SmsSettings> {
  if (!hasSupabaseEnv()) {
    return defaultSettings;
  }

  let orgId = organizationId;
  if (!orgId) {
    const ctx = await getOrgContext();
    if (!ctx) return defaultSettings;
    orgId = ctx.organizationId;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .maybeSingle();

  if (error || !data) {
    return defaultSettings;
  }

  const settings = (data.settings as Record<string, unknown>) ?? {};
  const sms = (settings.sms_settings as Record<string, unknown>) ?? {};

  return {
    enabled: (sms.sms_enabled as boolean) ?? defaultSettings.enabled,
    orderConfirmation:
      (sms.sms_order_confirmation as boolean) ??
      defaultSettings.orderConfirmation,
    depositReminder:
      (sms.sms_deposit_reminder as boolean) ?? defaultSettings.depositReminder,
    deliveryUpdates:
      (sms.sms_delivery_updates as boolean) ?? defaultSettings.deliveryUpdates,
    paymentConfirmation:
      (sms.sms_payment_confirmation as boolean) ??
      defaultSettings.paymentConfirmation,
    weatherAlerts:
      (sms.sms_weather_alerts as boolean) ?? defaultSettings.weatherAlerts,
    signature: (sms.sms_signature as string) ?? defaultSettings.signature,
  };
}
