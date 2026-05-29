import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getPublicOrgId } from "@/lib/auth/org-context";

/**
 * Count of assets in a "ready / available / active" operational state for the
 * current public org, ignoring deleted rows. Drives the storefront's
 * "{N} units open this Saturday" social-proof chip in the hero.
 *
 * Returns 0 when the org has no inventory or anon RLS denies the read.
 * Wrapped in cache() so multiple hero-related callers share one round-trip.
 */
export const getReadyAssetCount = cache(async function getReadyAssetCount(): Promise<number> {
  if (!hasSupabaseEnv()) return 0;

  const organizationId = await getPublicOrgId();
  if (!organizationId) return 0;

  const supabase = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();

  const { count, error } = await supabase
    .from("assets")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .in("operational_status", ["ready", "available", "active"])
    .is("deleted_at", null);

  if (error) return 0;
  return count ?? 0;
});
