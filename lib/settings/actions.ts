"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";

export type SettingsActionState = {
  ok: boolean;
  message: string;
  /** Returned by upload actions so the client can update its preview immediately. */
  url?: string;
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
  const heroHeadline = String(formData.get("hero_headline") ?? "").trim();
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
        hero_headline: heroHeadline || null,
        service_area_text: serviceAreaText || null,
        booking_message: bookingMessage || null,
      },
    })
    .eq("id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/website");
  revalidatePath("/");
  return { ok: true, message: "Website settings updated." };
}

export async function updateBookingPolicies(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const depositPercentage = Number(formData.get("deposit_percentage") ?? 30);
  const depositMinimum = formData.get("deposit_minimum")
    ? Number(formData.get("deposit_minimum"))
    : null;
  const requireDepositToConfirm = formData.get("require_deposit_to_confirm") === "on";
  const cancellationPolicyText = String(formData.get("cancellation_policy_text") ?? "").trim();
  const bookingLeadTimeHours = Number(formData.get("booking_lead_time_hours") ?? 24);
  const maxAdvanceBookingDays = Number(formData.get("max_advance_booking_days") ?? 180);

  if (Number.isNaN(depositPercentage) || depositPercentage < 0 || depositPercentage > 100) {
    return { ok: false, message: "Deposit percentage must be between 0 and 100." };
  }

  if (depositMinimum !== null && (Number.isNaN(depositMinimum) || depositMinimum < 0)) {
    return { ok: false, message: "Minimum deposit must be a positive number." };
  }

  if (Number.isNaN(bookingLeadTimeHours) || bookingLeadTimeHours < 0) {
    return { ok: false, message: "Lead time must be 0 or more hours." };
  }

  if (Number.isNaN(maxAdvanceBookingDays) || maxAdvanceBookingDays < 1) {
    return { ok: false, message: "Max advance booking must be at least 1 day." };
  }

  if (cancellationPolicyText.length > 2000) {
    return { ok: false, message: "Cancellation policy text is too long (max 2000 characters)." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Booking policies would be updated." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();

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
        deposit_percentage: depositPercentage,
        deposit_minimum: depositMinimum,
        require_deposit_to_confirm: requireDepositToConfirm,
        cancellation_policy_text: cancellationPolicyText || null,
        booking_lead_time_hours: bookingLeadTimeHours,
        max_advance_booking_days: maxAdvanceBookingDays,
      },
    })
    .eq("id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Booking policies updated." };
}
