"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { generateSlug, isSlugAvailable, isValidSlugFormat, getAppDomain } from "@/lib/auth/resolve-org";

export type OnboardingActionState = {
  ok: boolean;
  message: string;
  storefrontUrl?: string;
};

export async function completeOnboarding(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const businessName = String(formData.get("business_name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "America/New_York").trim();
  const zipCode = String(formData.get("zip_code") ?? "").trim();
  const deliveryFee = parseFloat(String(formData.get("delivery_fee") ?? "25"));
  const minimumOrder = parseFloat(String(formData.get("minimum_order") ?? "100"));
  let slugInput = String(formData.get("slug") ?? "").trim();

  if (!businessName) {
    return { ok: false, message: "Business name is required." };
  }

  // Generate slug if not provided
  if (!slugInput) {
    slugInput = generateSlug(businessName);
  }

  if (!isValidSlugFormat(slugInput)) {
    return {
      ok: false,
      message: "URL slug must be 3-63 lowercase letters, numbers, and hyphens.",
    };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: "${businessName}" would be created.`,
      storefrontUrl: `https://${slugInput}.${getAppDomain()}`,
    };
  }

  const available = await isSlugAvailable(slugInput);
  if (!available) {
    return {
      ok: false,
      message: "That URL slug is already taken or reserved. Please choose a different one.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      message: "You must be signed in to create an organization.",
    };
  }

  // Keep this fast redirect for already-onboarded users
  const { data: existingMembership } = await supabase
    .from("organization_memberships")
    .select("id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existingMembership) {
    redirect("/dashboard");
  }

  const { data, error } = await supabase.rpc("bootstrap_organization", {
    p_business_name: businessName,
    p_timezone: timezone,
    p_zip_code: zipCode || null,
    p_delivery_fee: Number.isFinite(deliveryFee) ? deliveryFee : 25,
    p_minimum_order: Number.isFinite(minimumOrder) ? minimumOrder : 100,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        message: "An organization with that name already exists.",
      };
    }

    return {
      ok: false,
      message: error.message || "Failed to complete onboarding.",
    };
  }

  if (!data) {
    return {
      ok: false,
      message: "Organization creation returned no result.",
    };
  }

  // Update the slug to the user's chosen one (the RPC may have generated a different one)
  const orgId = typeof data === "string" ? data : (data as any)?.organization_id ?? data;
  if (orgId) {
    await supabase
      .from("organizations")
      .update({ slug: slugInput })
      .eq("id", orgId);
  }

  redirect("/dashboard");
}
