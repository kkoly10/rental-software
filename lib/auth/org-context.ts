"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OrgContext = {
  userId: string;
  organizationId: string;
};

/**
 * Resolves the current authenticated user's organization via organization_memberships.
 * Returns null if not authenticated or no membership exists.
 * This is the correct multi-tenant approach — never use "first org in DB".
 */
export async function getOrgContext(): Promise<OrgContext | null> {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  return {
    userId: user.id,
    organizationId: membership.organization_id,
  };
}

/**
 * For public-facing pages (checkout, catalog), resolve org from the first active org.
 * Public visitors are not authenticated, so we use the service-level lookup.
 * In a multi-tenant SaaS with subdomains, this would resolve from the hostname.
 * For MVP single-tenant deployment, first org is acceptable for the public storefront.
 */
export async function getPublicOrgId(): Promise<string | null> {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return org?.id ?? null;
}
