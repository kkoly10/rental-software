import { getPublicOrgId } from "@/lib/auth/org-context";
import { isDemoOrganization } from "@/lib/demo/guard";

/**
 * Check if the current public tenant is the demo organization.
 * Use in server components to conditionally render demo UI.
 *
 * Returns `false` when the demo lookup is indeterminate (DB error) —
 * the UI flag fails conservatively by hiding the demo banner. The
 * mutation guard (blockDemoWrites) fails the other direction for safety.
 */
export async function isCurrentTenantDemo(): Promise<boolean> {
  const orgId = await getPublicOrgId();
  if (!orgId) return false;
  return (await isDemoOrganization(orgId)) === true;
}
