"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";
import { mergeOrgSettings } from "./merge-settings";

async function getUserRole(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  profileId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();
  return data?.role ?? null;
}

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
  const name = String(formData.get("name") ?? "").trim().slice(0, 255);
  const rawSupportEmail = String(formData.get("support_email") ?? "").trim().slice(0, 320);
  const phone = String(formData.get("phone") ?? "").trim().slice(0, 50);
  const timezone = String(formData.get("timezone") ?? "").trim().slice(0, 100);

  // Business details that appear on rental documents (agreement/waiver/
  // invoice). Stored in settings jsonb — no schema columns needed.
  const field = (key: string, max: number) =>
    String(formData.get(key) ?? "").trim().slice(0, max);
  const businessAddressLine1 = field("business_address_line1", 200);
  const businessAddressLine2 = field("business_address_line2", 200);
  const businessCity = field("business_city", 120);
  const businessState = field("business_state", 120);
  const businessPostalCode = field("business_postal_code", 20);
  const businessRepresentativeName = field("business_representative_name", 160);

  if (!name) {
    return { ok: false, message: "Business name is required." };
  }

  // support_email is used as a Reply-To address on outbound mail. A
  // value with CRLF / semicolons / multiple addresses would let an
  // owner inject extra mail headers. Validate strictly here; the
  // input element's type="email" is browser-only and easily bypassed.
  let supportEmail = "";
  if (rawSupportEmail) {
    const { strictParseEmail } = await import("@/lib/security/header-safe");
    const parsed = strictParseEmail(rawSupportEmail);
    if (!parsed) {
      return {
        ok: false,
        message: "Support email must be a single valid email address.",
      };
    }
    supportEmail = parsed;
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: `Demo mode: Business profile would be updated.` };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase, ctx.organizationId, ctx.userId);
  if (role !== "owner" && role !== "admin") {
    return { ok: false, message: "Only owners and admins can update business settings." };
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      support_email: supportEmail || null,
      phone: phone || null,
      timezone: timezone || "America/New_York",
    })
    .eq("id", ctx.organizationId)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, message: error.message };
  }

  // Document business details → settings jsonb (atomic shallow merge).
  const merged = await mergeOrgSettings(supabase, ctx.organizationId, {
    business_address_line1: businessAddressLine1 || null,
    business_address_line2: businessAddressLine2 || null,
    business_city: businessCity || null,
    business_state: businessState || null,
    business_postal_code: businessPostalCode || null,
    business_representative_name: businessRepresentativeName || null,
  });
  if (!merged.ok) {
    return { ok: false, message: merged.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/");
  return { ok: true, message: "Business profile updated." };
}

/**
 * Sprint 1.5 — Smart Delivery Mode toggle.
 *
 * Owner/admin only. Writes the `routing_mode` column directly (not the
 * settings JSON) so a future analytics query can answer "what fraction
 * of orgs use auto mode?" without unpacking a jsonb.
 */
export async function updateRoutingMode(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const raw = String(formData.get("routing_mode") ?? "").trim();
  if (raw !== "auto" && raw !== "manual") {
    return { ok: false, message: "Invalid routing mode." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: routing mode would be updated." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase, ctx.organizationId, ctx.userId);
  if (role !== "owner" && role !== "admin") {
    return {
      ok: false,
      message: "Only owners and admins can change routing mode.",
    };
  }

  const { error } = await supabase
    .from("organizations")
    .update({ routing_mode: raw })
    .eq("id", ctx.organizationId)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/deliveries");
  return {
    ok: true,
    message:
      raw === "auto"
        ? "Smart Delivery Mode is now on. New orders will auto-schedule."
        : "Manual route management is now on. You'll create routes yourself.",
  };
}

export async function updateWebsiteSettings(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const heroMessage = String(formData.get("hero_message") ?? "").trim().slice(0, 1000);
  const heroHeadline = String(formData.get("hero_headline") ?? "").trim().slice(0, 200);
  const serviceAreaText = String(formData.get("service_area_text") ?? "").trim().slice(0, 500);
  const bookingMessage = String(formData.get("booking_message") ?? "").trim().slice(0, 1000);

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Website settings would be updated." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();
  const role = await getUserRole(supabase, ctx.organizationId, ctx.userId);
  if (role !== "owner" && role !== "admin") {
    return { ok: false, message: "Only owners and admins can update website settings." };
  }

  const merged = await mergeOrgSettings(supabase, ctx.organizationId, {
    hero_message: heroMessage || null,
    hero_headline: heroHeadline || null,
    service_area_text: serviceAreaText || null,
    booking_message: bookingMessage || null,
  });
  if (!merged.ok) {
    return { ok: false, message: merged.message };
  }

  revalidatePath("/dashboard/website");
  revalidatePath("/");
  return { ok: true, message: "Website settings updated." };
}

export async function updateBookingPolicies(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  // formData.get returns "" for present-but-empty fields, which Number("")
  // coerces to 0 — so fall back to the default for null OR empty values.
  const numField = (key: string, fallback: number): number => {
    const raw = formData.get(key);
    if (raw === null || (typeof raw === "string" && raw.trim() === "")) return fallback;
    return Number(raw);
  };
  const depositPercentage = numField("deposit_percentage", 30);
  const depositMinimum = formData.get("deposit_minimum")
    ? Number(formData.get("deposit_minimum"))
    : null;
  const requireDepositToConfirm = formData.get("require_deposit_to_confirm") === "on";
  const cancellationPolicyText = String(formData.get("cancellation_policy_text") ?? "").trim();
  const bookingLeadTimeHours = numField("booking_lead_time_hours", 24);
  const maxAdvanceBookingDays = numField("max_advance_booking_days", 180);

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
  const role = await getUserRole(supabase, ctx.organizationId, ctx.userId);
  // #326 sibling actions (updateBusinessProfile, updateWebsiteSettings) accept
  // owner OR admin; matching that here removes the inconsistency where admin
  // can rename the org and rewrite the homepage but is blocked from editing
  // deposit/cancellation policy.
  if (!["owner", "admin"].includes(role ?? "")) {
    return { ok: false, message: "Only owners and admins can update booking policies." };
  }

  const merged = await mergeOrgSettings(supabase, ctx.organizationId, {
    deposit_percentage: depositPercentage,
    deposit_minimum: depositMinimum,
    require_deposit_to_confirm: requireDepositToConfirm,
    cancellation_policy_text: cancellationPolicyText || null,
    booking_lead_time_hours: bookingLeadTimeHours,
    max_advance_booking_days: maxAdvanceBookingDays,
  });
  if (!merged.ok) {
    return { ok: false, message: merged.message };
  }

  revalidatePath("/dashboard/settings");
  // #374 deposit %, lead time, max-advance days are read by getCheckoutPricing
  // and the storefront date picker.
  revalidatePath("/checkout");
  revalidatePath("/inventory", "layout");
  return { ok: true, message: "Booking policies updated." };
}
