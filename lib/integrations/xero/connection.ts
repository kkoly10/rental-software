import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { XeroTokens } from "./client";

/**
 * Persistence layer for the Xero OAuth connection.
 *
 * Split storage (Sprint 5.10 security hardening): OAuth credentials live in the
 * service-role-only `organization_oauth_credentials` table (read/written here
 * via the admin client); non-secret status (tenant id, connected_at,
 * last_sync_*) stays on `organizations` for the dashboard status UI. See
 * `lib/integrations/quickbooks/connection.ts` for the rationale.
 */

const CRED_TABLE = "organization_oauth_credentials";

export type XeroConnection = XeroTokens & {
  connectedAt: Date;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
};

export async function loadXeroConnection(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<XeroConnection | null> {
  const { data: org } = await supabase
    .from("organizations")
    .select("xero_tenant_id, xero_connected_at, xero_last_sync_at, xero_last_sync_error")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  const orow = org as Record<string, string | null> | null;
  if (!orow?.xero_tenant_id) return null;

  const admin = createSupabaseAdminClient();
  const { data: cred } = await admin
    .from(CRED_TABLE)
    .select("xero_access_token, xero_refresh_token, xero_token_expires_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const crow = cred as Record<string, string | null> | null;
  if (!crow?.xero_access_token || !crow.xero_refresh_token) {
    return null;
  }

  return {
    tenantId: orow.xero_tenant_id,
    accessToken: crow.xero_access_token,
    refreshToken: crow.xero_refresh_token,
    expiresAt: new Date(crow.xero_token_expires_at ?? Date.now()),
    connectedAt: new Date(orow.xero_connected_at ?? Date.now()),
    lastSyncAt: orow.xero_last_sync_at ? new Date(orow.xero_last_sync_at) : null,
    lastSyncError: orow.xero_last_sync_error,
  };
}

export async function persistXeroConnection(
  supabase: SupabaseClient,
  organizationId: string,
  tokens: XeroTokens,
): Promise<{ ok: boolean; message?: string }> {
  const admin = createSupabaseAdminClient();
  const { error: credError } = await admin.from(CRED_TABLE).upsert(
    {
      organization_id: organizationId,
      xero_access_token: tokens.accessToken,
      xero_refresh_token: tokens.refreshToken,
      xero_token_expires_at: tokens.expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (credError) return { ok: false, message: credError.message };

  const { error } = await supabase
    .from("organizations")
    .update({
      xero_tenant_id: tokens.tenantId,
      xero_connected_at: new Date().toISOString(),
      xero_last_sync_error: null,
    })
    .eq("id", organizationId)
    .is("deleted_at", null);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function persistRefreshedTokens(
  _supabase: SupabaseClient,
  organizationId: string,
  tokens: XeroTokens,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from(CRED_TABLE).upsert(
    {
      organization_id: organizationId,
      xero_access_token: tokens.accessToken,
      xero_refresh_token: tokens.refreshToken,
      xero_token_expires_at: tokens.expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
}

export async function clearXeroConnection(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from(CRED_TABLE).delete().eq("organization_id", organizationId);

  await supabase
    .from("organizations")
    .update({
      xero_tenant_id: null,
      xero_connected_at: null,
      xero_last_sync_at: null,
      xero_last_sync_error: null,
    })
    .eq("id", organizationId)
    .is("deleted_at", null);
}

export async function recordSyncSuccess(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<void> {
  await supabase
    .from("organizations")
    .update({
      xero_last_sync_at: new Date().toISOString(),
      xero_last_sync_error: null,
    })
    .eq("id", organizationId)
    .is("deleted_at", null);
}

export async function recordSyncFailure(
  supabase: SupabaseClient,
  organizationId: string,
  errorMessage: string,
): Promise<void> {
  await supabase
    .from("organizations")
    .update({
      xero_last_sync_error: errorMessage.slice(0, 500),
    })
    .eq("id", organizationId)
    .is("deleted_at", null);
}
