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
};

export async function getOrgSettings(): Promise<OrgSettings> {
  if (!hasSupabaseEnv()) return fallbackSettings;

  const ctx = await getOrgContext();
  if (!ctx) return fallbackSettings;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("name, support_email, phone, timezone, settings")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  if (error || !data) return fallbackSettings;

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
  };
}
