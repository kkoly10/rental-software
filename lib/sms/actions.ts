"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";
import type { SettingsActionState } from "@/lib/settings/actions";

export async function updateSmsSettings(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const smsEnabled = formData.get("sms_enabled") === "on";
  const smsOrderConfirmation = formData.get("sms_order_confirmation") === "on";
  const smsDepositReminder = formData.get("sms_deposit_reminder") === "on";
  const smsDeliveryUpdates = formData.get("sms_delivery_updates") === "on";
  const smsPaymentConfirmation =
    formData.get("sms_payment_confirmation") === "on";
  const smsWeatherAlerts = formData.get("sms_weather_alerts") === "on";
  const smsSignature = String(formData.get("sms_signature") ?? "").trim();

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: "Demo mode: SMS settings would be updated.",
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();

  // Read existing settings
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  const existingSettings = (org?.settings as Record<string, unknown>) ?? {};

  const { error } = await supabase
    .from("organizations")
    .update({
      settings: {
        ...existingSettings,
        sms_settings: {
          sms_enabled: smsEnabled,
          sms_order_confirmation: smsOrderConfirmation,
          sms_deposit_reminder: smsDepositReminder,
          sms_delivery_updates: smsDeliveryUpdates,
          sms_payment_confirmation: smsPaymentConfirmation,
          sms_weather_alerts: smsWeatherAlerts,
          sms_signature: smsSignature || null,
        },
      },
    })
    .eq("id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "SMS notification settings updated." };
}
