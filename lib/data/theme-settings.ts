import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getPublicOrgId } from "@/lib/auth/org-context";

export type PressLogo = { label: string; href?: string };
export type ThemeSecondaryCta = "none" | "request_quote" | "phone";

export type ThemeSettings = {
  themeId: string;
  headerPhoneVisible: boolean;
  ctaSecondary: ThemeSecondaryCta;
  pressLogos: PressLogo[];
  themeChipsEnabled: boolean;
  pressRowVisible: boolean;
  availabilityChipVisible: boolean;
  reviewsCardsVisible: boolean;
  themeChipRailVisible: boolean;
};

const defaultTheme: ThemeSettings = {
  themeId: "party-classic",
  headerPhoneVisible: true,
  ctaSecondary: "none",
  pressLogos: [],
  themeChipsEnabled: false,
  pressRowVisible: false,
  availabilityChipVisible: true,
  reviewsCardsVisible: true,
  themeChipRailVisible: true,
};

function clampString(v: unknown, fallback: string, max = 80): string {
  if (typeof v !== "string") return fallback;
  return v.slice(0, max);
}

function clampBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function clampCta(v: unknown): ThemeSecondaryCta {
  return v === "request_quote" || v === "phone" || v === "none" ? v : "none";
}

function clampPressLogos(v: unknown): PressLogo[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .slice(0, 8)
    .map((x) => ({
      label: clampString(x.label, "", 40),
      href: typeof x.href === "string" ? x.href.slice(0, 200) : undefined,
    }))
    .filter((x) => x.label);
}

/**
 * Read the new theme-related settings from organizations.settings JSONB.
 * Wrapped in cache() so per-request callers (header + hero + footer) share
 * a single round-trip. Uses admin client when configured — same anon-RLS
 * pattern as the rest of lib/data/* for the public storefront.
 */
export const getThemeSettings = cache(async function getThemeSettings(): Promise<ThemeSettings> {
  if (!hasSupabaseEnv()) return defaultTheme;

  const organizationId = await getPublicOrgId();
  if (!organizationId) return defaultTheme;

  const supabase = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return defaultTheme;

  const s = (data.settings as Record<string, unknown>) ?? {};
  const vis = (s.section_visibility as Record<string, unknown>) ?? {};

  return {
    themeId: clampString(s.theme_id, defaultTheme.themeId, 40),
    headerPhoneVisible: clampBool(s.header_phone_visible, defaultTheme.headerPhoneVisible),
    ctaSecondary: clampCta(s.cta_secondary),
    pressLogos: clampPressLogos(s.press_logos),
    themeChipsEnabled: clampBool(s.theme_chips_enabled, defaultTheme.themeChipsEnabled),
    pressRowVisible: clampBool(vis.press_row, defaultTheme.pressRowVisible),
    availabilityChipVisible: clampBool(vis.availability_chip, defaultTheme.availabilityChipVisible),
    reviewsCardsVisible: clampBool(vis.reviews_cards, defaultTheme.reviewsCardsVisible),
    themeChipRailVisible: clampBool(vis.theme_chip_rail, defaultTheme.themeChipRailVisible),
  };
});
