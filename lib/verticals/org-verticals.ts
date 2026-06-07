import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

/**
 * Phase 4 — org vertical lookups via the organization_verticals join
 * table (migration 20260608_150000_organization_verticals.sql).
 *
 * Multi-vertical orgs: an inflatable shop that also rents tents
 * declares both via rows on organization_verticals; the row with
 * is_primary = true is the canonical "what does the dashboard chrome
 * say I am" answer.
 *
 * During the migration window we fall back to OrgContext.businessType
 * (which is sourced from organizations.business_type) when the join
 * table has no rows for the current org — that way existing orgs that
 * haven't been backfilled yet still get the right copy.
 */

/** Returns the primary vertical slug for the active org, or null when
 *  there's no signed-in org context. Uses the join table first; falls
 *  back to business_type so old orgs keep working pre-backfill. */
export async function getPrimaryVerticalSlug(): Promise<string | null> {
  const ctx = await getOrgContext();
  if (!ctx) return null;

  if (!hasSupabaseEnv()) {
    return ctx.businessType ?? null;
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organization_verticals")
    .select("vertical_slug")
    .eq("organization_id", ctx.organizationId)
    .eq("is_primary", true)
    .maybeSingle();

  // Either no row yet (pre-backfill) or join-table row removed — fall
  // back to the legacy business_type so the dashboard never shows a
  // generic empty state for an org that picked a vertical at signup.
  return data?.vertical_slug ?? ctx.businessType ?? null;
}

/** All vertical slugs declared for the active org. Empty list when no
 *  org context. Useful for surfaces that should reflect every line of
 *  business — e.g. a "both bouncers and tents" empty-state hint. */
export async function listOrgVerticalSlugs(): Promise<string[]> {
  const ctx = await getOrgContext();
  if (!ctx) return [];

  if (!hasSupabaseEnv()) {
    return ctx.businessType ? [ctx.businessType] : [];
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organization_verticals")
    .select("vertical_slug, is_primary")
    .eq("organization_id", ctx.organizationId);

  if (!data || data.length === 0) {
    return ctx.businessType ? [ctx.businessType] : [];
  }

  // Primary first, then alphabetical for stable ordering.
  return [...data]
    .sort((a, b) => {
      if (a.is_primary && !b.is_primary) return -1;
      if (!a.is_primary && b.is_primary) return 1;
      return a.vertical_slug.localeCompare(b.vertical_slug);
    })
    .map((row) => row.vertical_slug);
}
