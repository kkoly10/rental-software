import { notFound } from "next/navigation";
import { getPublicOrgId, isTenantHost } from "@/lib/auth/org-context";

/**
 * Call from public storefront server-component pages to ensure the tenant exists.
 * If the visitor is on a tenant subdomain/custom domain that doesn't match
 * any organization, this triggers Next.js's not-found page.
 *
 * On the root domain or localhost this is a no-op (allows fallback/demo content).
 */
export async function requirePublicOrg(): Promise<void> {
  if (!(await isTenantHost())) return;
  const orgId = await getPublicOrgId();
  if (!orgId) {
    notFound();
  }
}
