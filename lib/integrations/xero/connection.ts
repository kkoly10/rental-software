import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { XeroTokens } from "./client";

export type XeroConnection = XeroTokens & {
  connectedAt: Date;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
};

export async function loadXeroConnection(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<XeroConnection | null> {
  const { data } = await supabase
    .from("organizations")
    .select(
      "xero_tenant_id, xero_access_token, xero_refresh_token, xero_token_expires_at, xero_connected_at, xero_last_sync_at, xero_last_sync_error",
    )
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  const row = data as Record<string, string | null> | null;
  if (!row?.xero_tenant_id || !row.xero_access_token || !row.xero_refresh_token) {
    return null;
  }

  return {
    tenantId: row.xero_tenant_id,
    accessToken: row.xero_access_token,
    refreshToken: row.xero_refresh_token,
    expiresAt: new Date(row.xero_token_expires_at ?? Date.now()),
    connectedAt: new Date(row.xero_connected_at ?? Date.now()),
    lastSyncAt: row.xero_last_sync_at ? new Date(row.xero_last_sync_at) : null,
    lastSyncError: row.xero_last_sync_error,
  };
}

export async function persistXeroConnection(
  supabase: SupabaseClient,
  organizationId: string,
  tokens: XeroTokens,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase
    .from("organizations")
    .update({
      xero_tenant_id: tokens.tenantId,
      xero_access_token: tokens.accessToken,
      xero_refresh_token: tokens.refreshToken,
      xero_token_expires_at: tokens.expiresAt.toISOString(),
      xero_connected_at: new Date().toISOString(),
      xero_last_sync_error: null,
    })
    .eq("id", organizationId)
    .is("deleted_at", null);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function persistRefreshedTokens(
  supabase: SupabaseClient,
  organizationId: string,
  tokens: XeroTokens,
): Promise<void> {
  await supabase
    .from("organizations")
    .update({
      xero_access_token: tokens.accessToken,
      xero_refresh_token: tokens.refreshToken,
      xero_token_expires_at: tokens.expiresAt.toISOString(),
    })
    .eq("id", organizationId)
    .is("deleted_at", null);
}

export async function clearXeroConnection(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<void> {
  await supabase
    .from("organizations")
    .update({
      xero_tenant_id: null,
      xero_access_token: null,
      xero_refresh_token: null,
      xero_token_expires_at: null,
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
