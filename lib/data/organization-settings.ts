import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";

const fallbackSettings = {
  businessName: "My Rental Business",
  supportEmail: "hello@example.com",
  phone: "(555) 000-0000",
  timezone: "America/New_York",
  currency: "USD",
  serviceAreaLabel: "Your service area",
  depositPolicy: "25% deposit to reserve event date",
  publicBookingLabel: "Public checkout enabled",
  featuredInventoryLabel: "3 highlighted products on homepage",
  websiteMessage: "Epic parties delivered with clean setup and on-time dropoff.",
  heroHeadline: "",
  heroImageUrl: "",
  bookingMessage: "",
  socialFacebook: "",
  socialInstagram: "",
  socialTiktok: "",
  socialGoogleBusiness: "",
  // Operator-provided legal-page overrides (absolute http(s) URLs). When set,
  // the storefront footer links to these instead of Korent's baseline pages.
  legalPrivacyUrl: "",
  legalTermsUrl: "",
  legalWaiverUrl: "",
};

export const getOrganizationSettings = cache(async function getOrganizationSettings() {
  if (!hasSupabaseEnv()) {
    return fallbackSettings;
  }

  const organizationId = await getPublicOrgId();
  if (!organizationId) {
    // No org found — return empty settings rather than fake contact info that
    // could mislead visitors on a misconfigured or unclaimed storefront.
    return {
      ...fallbackSettings,
      businessName: "",
      supportEmail: "",
      phone: "",
      websiteMessage: "",
    };
  }

  const supabase = await createSupabaseServerClient();

  const [{ data: organization }, { data: serviceAreas }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("name, timezone, default_currency, support_email, phone, settings")
        .eq("id", organizationId)
        .is("deleted_at", null)
        .maybeSingle(),
      supabase
        .from("service_areas")
        .select("label, city, state")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .is("deleted_at", null)
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

  const orgSettings = (organization?.settings as Record<string, unknown>) ?? {};

  return {
    businessName: organization?.name ?? fallbackSettings.businessName,
    supportEmail:
      (organization?.support_email as string) ??
      fallbackSettings.supportEmail,
    phone:
      (organization?.phone as string) ??
      fallbackSettings.phone,
    timezone: organization?.timezone ?? fallbackSettings.timezone,
    currency: organization?.default_currency ?? fallbackSettings.currency,
    serviceAreaLabel: (orgSettings.service_area_text as string) || areaLabel,
    depositPolicy: typeof orgSettings.deposit_percentage === "number"
      ? `${orgSettings.deposit_percentage}% deposit to reserve event date`
      : fallbackSettings.depositPolicy,
    publicBookingLabel: fallbackSettings.publicBookingLabel,
    featuredInventoryLabel: fallbackSettings.featuredInventoryLabel,
    // Empty string when the operator hasn't set hero_message — that way
    // the per-vertical default lede in storefrontDefaults takes over
    // instead of being clobbered by a generic platform fallback. The
    // SEO / opengraph callers below intentionally check for empty
    // strings and substitute their own defaults.
    websiteMessage: (orgSettings.hero_message as string) || "",
    heroHeadline:
      (orgSettings.hero_headline as string) || "",
    heroImageUrl:
      (orgSettings.hero_image_url as string) || "",
    bookingMessage: (orgSettings.booking_message as string) || "",
    socialFacebook: (orgSettings.social_facebook as string) || "",
    socialInstagram: (orgSettings.social_instagram as string) || "",
    socialTiktok: (orgSettings.social_tiktok as string) || "",
    socialGoogleBusiness: (orgSettings.social_google_business as string) || "",
    legalPrivacyUrl: (orgSettings.legal_privacy_url as string) || "",
    legalTermsUrl: (orgSettings.legal_terms_url as string) || "",
    legalWaiverUrl: (orgSettings.legal_waiver_url as string) || "",
  };
});