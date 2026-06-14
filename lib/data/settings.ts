import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type OrgSettings = {
  name: string;
  supportEmail: string;
  phone: string;
  timezone: string;
  heroMessage: string;
  heroHeadline: string;
  serviceAreaText: string;
  bookingMessage: string;
  heroImageUrl: string;
  socialFacebook: string;
  socialInstagram: string;
  socialTiktok: string;
  socialGoogleBusiness: string;
  // Operator-provided legal-page override URLs (absolute http(s)). Blank = use
  // Korent's storefront baseline pages.
  legalPrivacyUrl: string;
  legalTermsUrl: string;
  legalWaiverUrl: string;
  // Business details shown on rental documents (agreement/waiver/invoice).
  businessAddressLine1: string;
  businessAddressLine2: string;
  businessCity: string;
  businessState: string;
  businessPostalCode: string;
  businessRepresentativeName: string;
};

const fallbackSettings: OrgSettings = {
  name: "My Rental Business",
  supportEmail: "",
  phone: "",
  timezone: "America/New_York",
  heroMessage: "",
  heroHeadline: "",
  serviceAreaText: "",
  bookingMessage: "",
  heroImageUrl: "",
  socialFacebook: "",
  socialInstagram: "",
  socialTiktok: "",
  socialGoogleBusiness: "",
  legalPrivacyUrl: "",
  legalTermsUrl: "",
  legalWaiverUrl: "",
  businessAddressLine1: "",
  businessAddressLine2: "",
  businessCity: "",
  businessState: "",
  businessPostalCode: "",
  businessRepresentativeName: "",
};

export async function getOrgSettings(): Promise<OrgSettings> {
  if (!hasSupabaseEnv()) return fallbackSettings;

  const ctx = await getOrgContext();
  if (!ctx) return { ...fallbackSettings, name: "" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("name, support_email, phone, timezone, settings")
    .eq("id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[settings] Query failed:", error.message);
    return { ...fallbackSettings, name: "" };
  }
  if (!data) return { ...fallbackSettings, name: "" };

  const settings = (data.settings as Record<string, unknown>) ?? {};

  return {
    name: data.name ?? "",
    supportEmail: data.support_email ?? "",
    phone: data.phone ?? "",
    timezone: data.timezone ?? "America/New_York",
    heroMessage: (settings.hero_message as string) ?? "",
    heroHeadline: (settings.hero_headline as string) ?? "",
    serviceAreaText: (settings.service_area_text as string) ?? "",
    bookingMessage: (settings.booking_message as string) ?? "",
    heroImageUrl: (settings.hero_image_url as string) ?? "",
    socialFacebook: (settings.social_facebook as string) ?? "",
    socialInstagram: (settings.social_instagram as string) ?? "",
    socialTiktok: (settings.social_tiktok as string) ?? "",
    socialGoogleBusiness: (settings.social_google_business as string) ?? "",
    legalPrivacyUrl: (settings.legal_privacy_url as string) ?? "",
    legalTermsUrl: (settings.legal_terms_url as string) ?? "",
    legalWaiverUrl: (settings.legal_waiver_url as string) ?? "",
    businessAddressLine1: (settings.business_address_line1 as string) ?? "",
    businessAddressLine2: (settings.business_address_line2 as string) ?? "",
    businessCity: (settings.business_city as string) ?? "",
    businessState: (settings.business_state as string) ?? "",
    businessPostalCode: (settings.business_postal_code as string) ?? "",
    businessRepresentativeName: (settings.business_representative_name as string) ?? "",
  };
}
