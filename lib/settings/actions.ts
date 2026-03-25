"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";

export type SettingsActionState = {
  ok: boolean;
  message: string;
};

export async function updateBusinessProfile(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const supportEmail = String(formData.get("support_email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();

  if (!name) {
    return { ok: false, message: "Business name is required." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: `Demo mode: Business profile would be updated.` };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      support_email: supportEmail || null,
      phone: phone || null,
      timezone: timezone || "America/New_York",
    })
    .eq("id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Business profile updated." };
}

export async function updateWebsiteSettings(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const heroMessage = String(formData.get("hero_message") ?? "").trim();
  const serviceAreaText = String(formData.get("service_area_text") ?? "").trim();
  const bookingMessage = String(formData.get("booking_message") ?? "").trim();

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Website settings would be updated." };
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
        hero_message: heroMessage || null,
        service_area_text: serviceAreaText || null,
        booking_message: bookingMessage || null,
      },
    })
    .eq("id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/website");
  return { ok: true, message: "Website settings updated." };
}
