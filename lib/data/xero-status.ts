import "server-only";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { hasXeroEnv } from "@/lib/integrations/xero/config";

export type XeroStatus =
  | { configured: false }
  | { configured: true; connected: false }
  | {
      configured: true;
      connected: true;
      tenantId: string;
      connectedAt: string | null;
      lastSyncAt: string | null;
      lastSyncError: string | null;
    };

export async function getXeroStatus(): Promise<XeroStatus> {
  if (!hasXeroEnv()) return { configured: false };
  if (!hasSupabaseEnv()) return { configured: true, connected: false };
  const ctx = await getOrgContext();
  if (!ctx) return { configured: true, connected: false };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select(
      "xero_tenant_id, xero_connected_at, xero_last_sync_at, xero_last_sync_error",
    )
    .eq("id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  const row = data as Record<string, string | null> | null;
  if (!row?.xero_tenant_id) {
    return { configured: true, connected: false };
  }
  return {
    configured: true,
    connected: true,
    tenantId: row.xero_tenant_id,
    connectedAt: row.xero_connected_at ?? null,
    lastSyncAt: row.xero_last_sync_at ?? null,
    lastSyncError: row.xero_last_sync_error ?? null,
  };
}
