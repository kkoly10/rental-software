"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { mergeOrgSettings } from "@/lib/settings/merge-settings";
import type { SettingsActionState } from "@/lib/settings/actions";

export async function updateEmailSettings(
  _prev: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const flags = {
    payment_received: formData.get("email_payment_received") === "on",
    refund_processed: formData.get("email_refund_processed") === "on",
    document_signed: formData.get("email_document_signed") === "on",
    quote_accepted: formData.get("email_quote_accepted") === "on",
    order_cancelled: formData.get("email_order_cancelled") === "on",
    portal_message: formData.get("email_portal_message") === "on",
  };

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Email notification settings would be saved." };
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
  if (!["owner", "admin"].includes(membership?.role ?? "")) {
    return {
      ok: false,
      message: "Only owners and admins can update email notification settings.",
    };
  }

  const merged = await mergeOrgSettings(supabase, ctx.organizationId, {
    email_settings: flags,
  });
  if (!merged.ok) return { ok: false, message: merged.message };

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Email notification settings updated." };
}
