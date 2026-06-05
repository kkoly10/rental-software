import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Roles allowed to view/download financial documents (invoices, quotes) and
 * the signed-agreement PDFs. Mirrors the Copilot chat gate
 * (owner/admin/dispatcher) — crew and viewer are kept out of financials/PII.
 */
export const FINANCIAL_DOC_ROLES: readonly string[] = ["owner", "admin", "dispatcher"];

/**
 * The caller's active membership role in an org, or null if they have no
 * active membership. `getOrgContext()` deliberately doesn't return the role,
 * so sensitive routes that need a role check use this.
 */
export async function getActiveMemberRole(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return (data as { role?: string } | null)?.role ?? null;
}
