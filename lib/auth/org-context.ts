"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { resolveOrgFromHostname, getAppDomain } from "@/lib/auth/resolve-org";

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
 * Resolve the organization for public-facing pages (storefront, checkout, portal).
 * Uses hostname-based tenant resolution in production (subdomains and custom domains).
 * Falls back to first org on localhost / Vercel previews for development.
 */
export async function getPublicOrgId(): Promise<string | null> {
  if (!hasSupabaseEnv()) return null;

  const headersList = await headers();
  const host = headersList.get("host") ?? headersList.get("x-forwarded-host") ?? "localhost";

  return resolveOrgFromHostname(host);
}

/**
 * Returns true when the request arrived on a tenant subdomain or custom domain
 * (i.e. the middleware set x-tenant-host) — meaning the visitor expects a
 * specific storefront.  If getPublicOrgId() returns null while this is true,
 * the slug/domain doesn't match any organization and the page should 404.
 */
export async function isTenantHost(): Promise<boolean> {
  const headersList = await headers();
  if (headersList.get("x-tenant-host")) {
    return true;
  }

  const host = headersList.get("host") ?? headersList.get("x-forwarded-host") ?? "localhost";
  const hostWithoutPort = host.split(":")[0];
  const appDomain = getAppDomain().split(":")[0];

  if (
    hostWithoutPort === "localhost" ||
    hostWithoutPort === "127.0.0.1" ||
    hostWithoutPort.endsWith(".vercel.app") ||
    hostWithoutPort === appDomain ||
    hostWithoutPort === `www.${appDomain}`
  ) {
    return false;
  }

  return true;
}
