import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type CopilotAccessContext = {
  userId: string;
  email: string | null;
  organizationId: string;
};

/**
 * Resolve the Copilot caller's org via `getOrgContext`, which honors the
 * active-org cookie when the user has multiple memberships. The previous
 * implementation here selected the *oldest* membership unconditionally,
 * which produced a multi-tenancy hole: the route-level role gate ran
 * against the wrong org for any operator with ≥2 active orgs (gate
 * passes/fails against tenant A while the inner write lands on tenant B).
 * Audit logs were also filed under the wrong tenant.
 */
export async function getCopilotAccessContext(): Promise<CopilotAccessContext | null> {
  if (!hasSupabaseEnv()) return null;
  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email_confirmed_at) {
    return null;
  }

  return {
    userId: ctx.userId,
    email: user.email ?? null,
    organizationId: ctx.organizationId,
  };
}
