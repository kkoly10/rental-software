import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Per-request cache to avoid repeated DB lookups within the same server action.
 */
const demoCache = new Map<string, boolean>();

/**
 * Check whether the given org is a demo organization.
 * Result is cached for the lifetime of the current request module scope.
 */
export async function isDemoOrganization(orgId: string): Promise<boolean> {
  if (!hasSupabaseEnv()) return false;

  if (demoCache.has(orgId)) return demoCache.get(orgId)!;

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select("is_demo")
    .eq("id", orgId)
    .maybeSingle();

  const isDemo = data?.is_demo === true;
  demoCache.set(orgId, isDemo);
  return isDemo;
}

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
