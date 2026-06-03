import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { QboTokens } from "./client";

/**
 * Persistence layer for the QuickBooks OAuth connection (Sprint 2).
 *
 * Tokens live on the `organizations` table. See the migration
 * `20260603_040000_quickbooks_online_connection.sql` for the column
 * shape and the encryption-at-rest TODO.
 */

export type QboConnection = QboTokens & {
  connectedAt: Date;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
};

export async function loadQboConnection(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<QboConnection | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "qbo_realm_id, qbo_access_token, qbo_refresh_token, qbo_token_expires_at, qbo_connected_at, qbo_last_sync_at, qbo_last_sync_error",
    )
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, string | null>;
  if (!row.qbo_realm_id || !row.qbo_access_token || !row.qbo_refresh_token) {
    return null;
  }

  return {
    realmId: row.qbo_realm_id,
    accessToken: row.qbo_access_token,
    refreshToken: row.qbo_refresh_token,
    expiresAt: new Date(row.qbo_token_expires_at ?? Date.now()),
    // Refresh-token expiry isn't stored on the row (Intuit's 100-day
    // window is long enough that we'll see the disconnect via the
    // refresh failing first). Surface a sentinel far-future value so
    // ensureFreshTokens treats it as valid.
    refreshTokenExpiresAt: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
    connectedAt: new Date(row.qbo_connected_at ?? Date.now()),
    lastSyncAt: row.qbo_last_sync_at ? new Date(row.qbo_last_sync_at) : null,
    lastSyncError: row.qbo_last_sync_error,
  };
}

export async function persistQboConnection(
  supabase: SupabaseClient,
  organizationId: string,
  tokens: QboTokens,
  options?: { connectedAt?: Date },
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase
    .from("organizations")
    .update({
      qbo_realm_id: tokens.realmId,
      qbo_access_token: tokens.accessToken,
      qbo_refresh_token: tokens.refreshToken,
      qbo_token_expires_at: tokens.expiresAt.toISOString(),
      qbo_connected_at:
        options?.connectedAt?.toISOString() ?? new Date().toISOString(),
      qbo_last_sync_error: null,
    })
    .eq("id", organizationId)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, message: error.message };
  }
  return { ok: true };
}

/**
 * Re-persist only the refreshed tokens (called from the lazy-refresh
 * path inside qboFetch). Avoids stomping on `qbo_connected_at` and
 * `qbo_last_sync_error` which the caller didn't intend to change.
 */
export async function persistRefreshedTokens(
  supabase: SupabaseClient,
  organizationId: string,
  tokens: QboTokens,
): Promise<void> {
  await supabase
    .from("organizations")
    .update({
      qbo_access_token: tokens.accessToken,
      qbo_refresh_token: tokens.refreshToken,
      qbo_token_expires_at: tokens.expiresAt.toISOString(),
    })
    .eq("id", organizationId)
    .is("deleted_at", null);
}

export async function clearQboConnection(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<void> {
  await supabase
    .from("organizations")
    .update({
      qbo_realm_id: null,
      qbo_access_token: null,
      qbo_refresh_token: null,
      qbo_token_expires_at: null,
      qbo_connected_at: null,
      qbo_last_sync_at: null,
      qbo_last_sync_error: null,
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
      qbo_last_sync_at: new Date().toISOString(),
      qbo_last_sync_error: null,
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
      qbo_last_sync_error: errorMessage.slice(0, 500),
    })
    .eq("id", organizationId)
    .is("deleted_at", null);
}
