import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Check whether the given org is a demo organization.
 * Wrapped in React cache() for request-scoped deduplication — the module-level
 * Map approach would persist stale data across requests on the same server instance.
 *
 * Returns `true` for confirmed demo orgs, `false` for confirmed non-demo,
 * and `null` when the lookup could not be performed (no Supabase env or
 * a DB error). `null` lets callers fail-closed instead of treating an
 * indeterminate state as "not demo".
 */
export const isDemoOrganization = cache(async (orgId: string): Promise<boolean | null> => {
  if (!hasSupabaseEnv()) return false;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("organizations")
    .select("is_demo")
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    console.error("[demo-guard] org lookup failed", { orgId, message: error.message });
    return null;
  }
  if (!data) return false;
  return data.is_demo === true;
});

export type DemoGuardResult = { blocked: true; message: string } | { blocked: false };

const DEMO_BLOCK_MESSAGE =
  "This is a live demo. Sign up to create your own storefront and start taking real bookings.";
const INFRA_ERROR_MESSAGE =
  "Service temporarily unavailable. Please try again in a moment.";

/**
 * Central guard for all public mutation paths on demo orgs.
 * Call at the top of any public write action before any DB side effects.
 *
 * Returns { blocked: false } for confirmed non-demo orgs, or
 * { blocked: true, message } for demo orgs. On infrastructure failure
 * the guard fails closed — better to surface a transient error to the
 * user than to let a demo org's data be modified during a DB outage.
 */
export async function blockDemoWrites(orgId: string | null): Promise<DemoGuardResult> {
  if (!orgId) return { blocked: false };

  const isDemo = await isDemoOrganization(orgId);
  if (isDemo === true) {
    return { blocked: true, message: DEMO_BLOCK_MESSAGE };
  }
  if (isDemo === null) {
    return { blocked: true, message: INFRA_ERROR_MESSAGE };
  }
  return { blocked: false };
}
