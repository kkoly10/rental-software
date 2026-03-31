import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type BrandSettings = {
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
};

const defaultBrand: BrandSettings = {
  logoUrl: "",
  primaryColor: "#1e5dcf",
  accentColor: "#20b486",
  fontFamily: "System Default",
};

export async function getBrandSettings(): Promise<BrandSettings> {
  if (!hasSupabaseEnv()) return defaultBrand;

  const ctx = await getOrgContext();
  if (!ctx) return defaultBrand;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  if (error || !data) return defaultBrand;

  const settings = (data.settings as Record<string, unknown>) ?? {};

  return {
    logoUrl: (settings.brand_logo_url as string) ?? "",
    primaryColor: (settings.brand_primary_color as string) ?? "#1e5dcf",
    accentColor: (settings.brand_accent_color as string) ?? "#20b486",
    fontFamily: (settings.brand_font_family as string) ?? "System Default",
  };
}
