"use server";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOrgFromHostname, getAppDomain } from "@/lib/auth/resolve-org";
import { ACTIVE_ORG_COOKIE } from "@/lib/auth/org-cookie";

export type OrgContext = {
  userId: string;
  organizationId: string;
  businessType: string;
};

/**
 * Resolves the current authenticated user's organization via organization_memberships.
 * Returns null if not authenticated or no membership exists.
 * This is the correct multi-tenant approach — never use "first org in DB".
 *
 * Wrapped in React cache() so a single request rendering multiple server
 * components/data loaders only runs the auth.getUser + membership lookup once.
 */
const resolveOrgContext = cache(async (): Promise<OrgContext | null> => {
  if (!hasSupabaseEnv()) return null;

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Load every active membership so we can honour the active-org cookie
  // when the user has more than one. Limited so a runaway membership
  // count can't drag the request — operators with >50 active orgs are
  // not a real concern today.
  const { data: memberships } = await supabase
    .from("organization_memberships")
    .select("organization_id, created_at, organizations!inner(business_type)")
    .eq("profile_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(50);

  if (!memberships || memberships.length === 0) return null;

  let chosen = memberships[0];
  if (memberships.length > 1) {
    const cookieStore = await cookies();
    const requested = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
    if (requested) {
      const match = memberships.find((m) => m.organization_id === requested);
      if (match) {
        chosen = match;
      } else {
        // Cookie points to an org the user no longer belongs to (membership
        // revoked or org deleted). Silently falling back to the oldest org
        // can confuse the operator when they next try a write and it lands
        // on a different tenant — log the swap so we can surface it later
        // and prompt a re-pick.
        try {
          const { logAppEvent } = await import("@/lib/observability/server");
          await logAppEvent({
            userId: user.id,
            source: "auth.org-context",
            action: "stale_active_org_cookie",
            status: "info",
            metadata: { requested, fallback: chosen.organization_id },
          });
        } catch {
          // Logging is best-effort.
        }
      }
    }
  }

  const orgs = chosen.organizations as unknown as { business_type: string } | null;
  const businessType = orgs?.business_type ?? "inflatable";

  return {
    userId: user.id,
    organizationId: chosen.organization_id,
    businessType,
  };
});

export async function getOrgContext(): Promise<OrgContext | null> {
  return resolveOrgContext();
}

/**
 * Resolve the organization for public-facing pages (storefront, checkout, portal).
 * Uses hostname-based tenant resolution in production (subdomains and custom domains).
 * Falls back to first org on localhost / Vercel previews for development.
 */
// Per-request cache: storefront pages call this from multiple data loaders.
const resolvePublicOrgId = cache(async (): Promise<string | null> => {
  if (!hasSupabaseEnv()) return null;

  const headersList = await headers();
  const host = headersList.get("host") ?? headersList.get("x-forwarded-host") ?? "localhost";

  return resolveOrgFromHostname(host);
});

export async function getPublicOrgId(): Promise<string | null> {
  return resolvePublicOrgId();
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
