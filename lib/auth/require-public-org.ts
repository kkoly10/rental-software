import { notFound } from "next/navigation";
import { getPublicOrgId, isTenantHost } from "@/lib/auth/org-context";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Call from public storefront server-component pages to ensure the tenant exists
 * and their subscription is in good standing.
 *
 * IMPORTANT: Storefront pages (/inventory, /checkout, /order-status, etc.)
 * should ONLY be accessible on tenant subdomains/custom domains, NOT on the
 * root marketing domain. On the root domain, these routes 404 to prevent
 * leaking the first org's data through the dev fallback.
 *
 * Exception: localhost / Vercel previews allow fallback for dev convenience.
 */
export async function requirePublicOrg(): Promise<void> {
  const isTenant = await isTenantHost();

  if (!isTenant) {
    // On the root domain in production, storefront pages should not be accessible.
    // Only allow fallback on localhost / Vercel previews (dev mode).
    if (hasSupabaseEnv() && isProductionRootDomain()) {
      notFound();
    }
    // In dev mode (localhost, no Supabase env), allow fallback content
    return;
  }

  const orgId = await getPublicOrgId();
  if (!orgId) {
    notFound();
  }

  // Check subscription status — disable storefront if canceled > 7 days
  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("subscription_status, subscription_canceled_at")
      .eq("id", orgId)
      .maybeSingle();

    if (org?.subscription_status === "canceled") {
      // Use the dedicated cancellation timestamp, not updated_at which resets on any edit
      const canceledAt = org.subscription_canceled_at
        ? new Date(org.subscription_canceled_at)
        : new Date(0);
      const daysSinceCanceled =
        (Date.now() - canceledAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCanceled > 7) {
        notFound();
      }
    }
  }
}

/**
 * Returns true when we're running on the real production root domain
 * (not localhost, not Vercel preview).
 */
function isProductionRootDomain(): boolean {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN;
  // If no app domain is configured, we're in dev — allow fallback
  if (!appDomain || appDomain.includes("localhost")) return false;
  return true;
}
