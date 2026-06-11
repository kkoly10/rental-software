import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { getVertical } from "./registry";
import { inflatableVertical } from "./inflatables";
import type { VerticalStorefrontDefaults } from "./types";

/**
 * Public-org variant of getPrimaryVerticalSlug — resolves the active
 * tenant subdomain's primary vertical for use on the editorial
 * storefront. The dashboard equivalent in org-verticals.ts uses
 * getOrgContext which requires a signed-in operator; storefront
 * visitors are anonymous, so we go through getPublicOrgId instead.
 */
export const getPublicPrimaryVerticalSlug = cache(async (): Promise<string | null> => {
  const orgId = await getPublicOrgId();
  if (!orgId || !hasSupabaseEnv()) return null;

  const supabase = await createSupabaseServerClient();

  const { data: vrow } = await supabase
    .from("organization_verticals")
    .select("vertical_slug")
    .eq("organization_id", orgId)
    .eq("is_primary", true)
    .maybeSingle();

  if (vrow?.vertical_slug) return vrow.vertical_slug;

  // Pre-backfill fallback: read business_type off the org row directly.
  const { data: org } = await supabase
    .from("organizations")
    .select("business_type")
    .eq("id", orgId)
    .maybeSingle();

  return (org as { business_type?: string | null } | null)?.business_type ?? null;
});

/**
 * Resolve the storefront defaults for the active tenant. Falls back
 * to the inflatable defaults when (a) no org is resolved, (b) the
 * resolved vertical slug has no `storefrontDefaults` configured, or
 * (c) Supabase is not available (dev). Always returns a valid object.
 */
export const getStorefrontDefaults = cache(async (): Promise<VerticalStorefrontDefaults> => {
  const slug = await getPublicPrimaryVerticalSlug();
  if (slug) {
    const v = getVertical(slug);
    if (v?.storefrontDefaults) return v.storefrontDefaults;
  }
  // Safe fallback — every storefront has a valid default even if the
  // org row is missing a vertical declaration.
  return inflatableVertical.storefrontDefaults!;
});

/**
 * Interpolate {area} in a defaults string with the operator's
 * service-area label. Falls back to "your area" when the label is
 * empty or whitespace.
 */
export function withArea(template: string, area: string | null | undefined): string {
  const safeArea = area && area.trim().length > 0 ? area.trim() : "your area";
  return template.replace(/\{area\}/g, safeArea);
}
