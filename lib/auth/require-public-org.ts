import { notFound } from "next/navigation";
import { getPublicOrgId, isTenantHost } from "@/lib/auth/org-context";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Call from public storefront server-component pages to ensure the tenant exists
 * and their subscription is in good standing.
 *
 * If the visitor is on a tenant subdomain/custom domain that doesn't match
 * any organization, this triggers Next.js's not-found page.
 *
 * If the operator's subscription has been canceled for more than 7 days,
 * the storefront is disabled (shows not-found instead of the operator's site).
 * This prevents freeloading — operators must maintain an active subscription
 * (or be on the free tier) for their public storefront to remain live.
 *
 * On the root domain or localhost this is a no-op (allows fallback/demo content).
 */
export async function requirePublicOrg(): Promise<void> {
  if (!(await isTenantHost())) return;
  const orgId = await getPublicOrgId();
  if (!orgId) {
    notFound();
  }

  // Check subscription status — disable storefront if canceled > 7 days
  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const { data: org } = await supabase
      .from("organizations")
      .select("subscription_status, updated_at")
      .eq("id", orgId)
      .maybeSingle();

    if (org?.subscription_status === "canceled") {
      // Allow a 7-day grace period after cancellation
      const updatedAt = org.updated_at ? new Date(org.updated_at) : new Date(0);
      const daysSinceCanceled = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCanceled > 7) {
        notFound();
      }
    }
  }
}
