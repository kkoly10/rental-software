import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type OrgSettings = {
  name: string;
  supportEmail: string;
  phone: string;
  timezone: string;
  heroMessage: string;
  serviceAreaText: string;
  bookingMessage: string;
};

const fallbackSettings: OrgSettings = {
  name: "My Rental Business",
  supportEmail: "",
  phone: "",
  timezone: "America/New_York",
  heroMessage: "",
  serviceAreaText: "",
  bookingMessage: "",
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
    serviceAreaText: (settings.service_area_text as string) ?? "",
    bookingMessage: (settings.booking_message as string) ?? "",
  };
}
