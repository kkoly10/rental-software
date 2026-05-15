import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Check whether the given org is a demo organization.
 * Wrapped in React cache() for request-scoped deduplication — the module-level
 * Map approach would persist stale data across requests on the same server instance.
 */
export const isDemoOrganization = cache(async (orgId: string): Promise<boolean> => {
  if (!hasSupabaseEnv()) return false;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select("is_demo")
    .eq("id", orgId)
    .maybeSingle();

  return data?.is_demo === true;
});

export type DemoGuardResult = { blocked: true; message: string } | { blocked: false };

const DEMO_BLOCK_MESSAGE =
  "This is a live demo. Sign up to create your own storefront and start taking real bookings.";

/**
 * Central guard for all public mutation paths on demo orgs.
 * Call at the top of any public write action before any DB side effects.
 *
 * Returns { blocked: false } for non-demo orgs, or { blocked: true, message }
 * for demo orgs. Callers should return the message to the user.
 */
export async function blockDemoWrites(orgId: string | null): Promise<DemoGuardResult> {
  if (!orgId) return { blocked: false };

  const isDemo = await isDemoOrganization(orgId);
  if (isDemo) {
    return { blocked: true, message: DEMO_BLOCK_MESSAGE };
  }
  return { blocked: false };
}
