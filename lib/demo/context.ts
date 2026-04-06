import { getPublicOrgId } from "@/lib/auth/org-context";
import { isDemoOrganization } from "@/lib/demo/guard";

/**
 * Check if the current public tenant is the demo organization.
 * Use in server components to conditionally render demo UI.
 */
export async function isCurrentTenantDemo(): Promise<boolean> {
  const orgId = await getPublicOrgId();
  if (!orgId) return false;
  return isDemoOrganization(orgId);
}
