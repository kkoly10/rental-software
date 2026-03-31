import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

const fallbackSettings = {
  businessName: "My Rental Business",
  supportEmail: "hello@example.com",
  phone: "(555) 000-0000",
  timezone: "America/New_York",
  currency: "USD",
  serviceAreaLabel: "Your service area",
  depositPolicy: "25% deposit to reserve event date",
  publicBookingLabel: "Public checkout enabled",
  featuredInventoryLabel: "3 highlighted inflatables on homepage",
  websiteMessage: "Epic parties delivered with clean setup and on-time dropoff.",
};

export async function getOrganizationSettings() {
  if (!hasSupabaseEnv()) {
    return fallbackSettings;
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return fallbackSettings;
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: organization }, { data: profile }, { data: serviceAreas }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("name, timezone, default_currency")
        .eq("id", ctx.organizationId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("email, phone")
        .eq("id", ctx.userId)
        .maybeSingle(),
      supabase
        .from("service_areas")
        .select("label, city, state")
        .eq("organization_id", ctx.organizationId)
        .eq("is_active", true)
        .limit(3),
    ]);

  const areaLabel =
    serviceAreas && serviceAreas.length > 0
      ? serviceAreas
          .map(
            (area) =>
              area.label ||
              [area.city, area.state].filter(Boolean).join(", ")
          )
          .filter(Boolean)
          .join(" • ")
      : fallbackSettings.serviceAreaLabel;

  return {
    businessName: organization?.name ?? fallbackSettings.businessName,
    supportEmail: profile?.email ?? fallbackSettings.supportEmail,
    phone: profile?.phone ?? fallbackSettings.phone,
    timezone: organization?.timezone ?? fallbackSettings.timezone,
    currency: organization?.default_currency ?? fallbackSettings.currency,
    serviceAreaLabel: areaLabel,
    depositPolicy: fallbackSettings.depositPolicy,
    publicBookingLabel: fallbackSettings.publicBookingLabel,
    featuredInventoryLabel: fallbackSettings.featuredInventoryLabel,
    websiteMessage: fallbackSettings.websiteMessage,
  };
}