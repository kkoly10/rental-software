"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";
import type { SettingsActionState } from "@/lib/settings/actions";
import { mergeOrgSettings } from "@/lib/settings/merge-settings";

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
  // SMS bodies are 160 chars (GSM-7) or 70 chars (UCS-2) per segment, so
  // a signature longer than 80 chars would push almost every outbound
  // message into multi-segment territory. Cap aggressively rather than
  // letting an unbounded string land in the database.
  if (smsSignature.length > 80) {
    return {
      ok: false,
      message: "SMS signature must be 80 characters or fewer.",
    };
  }

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

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();

  const role = membership?.role ?? null;
  if (role !== "owner" && role !== "admin") {
    return { ok: false, message: "Only owners and admins can update SMS settings." };
  }

  // SMS is a Pro-tier feature — block enabling it below Pro even if the
  // toggle is forced on via a direct POST (the UI also disables it).
  if (smsEnabled) {
    const { checkFeatureAccess } = await import("@/lib/stripe/gate");
    const access = await checkFeatureAccess("sms");
    if (!access.allowed) {
      return {
        ok: false,
        message: "SMS notifications are a Pro feature. Upgrade your plan to enable them.",
      };
    }
  }

  const merged = await mergeOrgSettings(supabase, ctx.organizationId, {
    sms_settings: {
      sms_enabled: smsEnabled,
      sms_order_confirmation: smsOrderConfirmation,
      sms_deposit_reminder: smsDepositReminder,
      sms_delivery_updates: smsDeliveryUpdates,
      sms_payment_confirmation: smsPaymentConfirmation,
      sms_weather_alerts: smsWeatherAlerts,
      sms_signature: smsSignature || null,
    },
  });

  if (!merged.ok) {
    return { ok: false, message: merged.message };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "SMS notification settings updated." };
}
