"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type OnboardingActionState = {
  ok: boolean;
  message: string;
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function completeOnboarding(
  _prevState: OnboardingActionState,
  formData: FormData
): Promise<OnboardingActionState> {
  const businessName = String(formData.get("business_name") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "America/New_York").trim();
  const zipCode = String(formData.get("zip_code") ?? "").trim();
  const deliveryFee = parseFloat(String(formData.get("delivery_fee") ?? "25"));
  const minimumOrder = parseFloat(String(formData.get("minimum_order") ?? "100"));

  if (!businessName) {
    return { ok: false, message: "Business name is required." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: `Demo mode: "${businessName}" would be created. Add Supabase env vars to enable.` };
  }

  const supabase = await createSupabaseServerClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "You must be signed in to create an organization." };
  }

  // Create organization
  const slug = slugify(businessName);
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: businessName,
      slug,
      business_type: "inflatable",
      timezone,
    })
    .select("id")
    .single();

  if (orgError || !org) {
    if (orgError?.code === "23505") {
      return { ok: false, message: "An organization with that name already exists." };
    }
    return { ok: false, message: orgError?.message ?? "Failed to create organization." };
  }

  // Create membership
  await supabase.from("organization_memberships").insert({
    organization_id: org.id,
    profile_id: user.id,
    role: "owner",
    status: "active",
  });

  // Seed a default service area if zip provided
  if (zipCode) {
    await supabase.from("service_areas").insert({
      organization_id: org.id,
      label: "Primary",
      zip_code: zipCode,
      delivery_fee: deliveryFee,
      minimum_order_amount: minimumOrder,
      is_active: true,
    });
  }

  // Seed starter categories
  const starterCategories = [
    { name: "Bounce Houses", slug: "bounce-houses", sort_order: 1 },
    { name: "Water Slides", slug: "water-slides", sort_order: 2 },
    { name: "Combo Units", slug: "combos", sort_order: 3 },
    { name: "Obstacle Courses", slug: "obstacle-courses", sort_order: 4 },
    { name: "Add-ons", slug: "add-ons", sort_order: 5 },
  ];

  await supabase.from("categories").insert(
    starterCategories.map((cat) => ({
      organization_id: org.id,
      ...cat,
      vertical: "inflatable",
      is_active: true,
    }))
  );

  redirect("/dashboard");
}
