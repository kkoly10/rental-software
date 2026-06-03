"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WhatsAppSettingsState = {
  ok: boolean;
  message: string;
};

/**
 * Sprint 4 — owner/admin action to flip the org's WhatsApp channel.
 * Off by default; the operator turns it on once their Twilio WhatsApp
 * sender is approved by Meta. The sender id field stores the
 * `whatsapp:+E.164` Twilio sender — the form normalizes the input
 * to remove leading "whatsapp:" if the operator pastes the full
 * value.
 */
export async function updateWhatsAppSettings(
  _prev: WhatsAppSettingsState,
  formData: FormData,
): Promise<WhatsAppSettingsState> {
  const enabled = String(formData.get("enabled") ?? "") === "on";
  const rawSenderId = String(formData.get("sender_id") ?? "").trim();
  const senderId = rawSenderId.replace(/^whatsapp:/i, "").trim();

  if (enabled && !senderId) {
    return {
      ok: false,
      message: "WhatsApp sender id is required when the channel is enabled.",
    };
  }

  if (senderId && !/^\+?[0-9]{6,15}$/.test(senderId)) {
    return {
      ok: false,
      message: "Sender id must be the Twilio WhatsApp number in E.164 format (e.g. +14155551234).",
    };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: WhatsApp settings would be updated." };
  }
  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (membership?.role !== "owner" && membership?.role !== "admin") {
    return {
      ok: false,
      message: "Only owners and admins can change WhatsApp settings.",
    };
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      whatsapp_enabled: enabled,
      whatsapp_sender_id: senderId ? senderId : null,
    })
    .eq("id", ctx.organizationId)
    .is("deleted_at", null);
  if (error) return { ok: false, message: error.message };

  revalidatePath("/dashboard/settings");
  return {
    ok: true,
    message: enabled
      ? "WhatsApp is on. Customers who opt in will receive WhatsApp notifications."
      : "WhatsApp turned off. All customer notifications fall back to SMS.",
  };
}
