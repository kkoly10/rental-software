import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { QboTokens } from "./client";

/**
 * Persistence layer for the QuickBooks OAuth connection (Sprint 2).
 *
 * Split storage (Sprint 5.10 security hardening):
 *   - OAuth credentials (access/refresh token + expiry) live in
 *     `organization_oauth_credentials`, a service-role-only table (RLS on,
 *     no policies, grants revoked from anon/authenticated). They are read and
 *     written here exclusively via the admin (service-role) client, so no org
 *     member can read or overwrite them through the API.
 *   - Non-secret connection status (realm id, connected_at, last_sync_*) stays
 *     on `organizations`, readable by members for the dashboard status UI.
 */

const CRED_TABLE = "organization_oauth_credentials";

export type QboConnection = QboTokens & {
  connectedAt: Date;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
};

export async function loadQboConnection(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<QboConnection | null> {
  // Non-secret status (caller's client is fine — members can read their org).
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("qbo_realm_id, qbo_connected_at, qbo_last_sync_at, qbo_last_sync_error")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (orgError || !org) return null;
  const orow = org as Record<string, string | null>;
  if (!orow.qbo_realm_id) return null;

  // Secret tokens — service-role-only table.
  const admin = createSupabaseAdminClient();
  const { data: cred } = await admin
    .from(CRED_TABLE)
    .select("qbo_access_token, qbo_refresh_token, qbo_token_expires_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  const crow = cred as Record<string, string | null> | null;
  if (!crow?.qbo_access_token || !crow.qbo_refresh_token) {
    return null;
  }

  return {
    realmId: orow.qbo_realm_id,
    accessToken: crow.qbo_access_token,
    refreshToken: crow.qbo_refresh_token,
    expiresAt: new Date(crow.qbo_token_expires_at ?? Date.now()),
    // Refresh-token expiry isn't stored (Intuit's 100-day window is long
    // enough that we'll see the disconnect via the refresh failing first).
    // Surface a sentinel far-future value so ensureFreshTokens treats it as valid.
    refreshTokenExpiresAt: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
    connectedAt: new Date(orow.qbo_connected_at ?? Date.now()),
    lastSyncAt: orow.qbo_last_sync_at ? new Date(orow.qbo_last_sync_at) : null,
    lastSyncError: orow.qbo_last_sync_error,
  };
}

export async function persistQboConnection(
  supabase: SupabaseClient,
  organizationId: string,
  tokens: QboTokens,
  options?: { connectedAt?: Date },
): Promise<{ ok: boolean; message?: string }> {
  // Tokens → service-role-only table.
  const admin = createSupabaseAdminClient();
  const { error: credError } = await admin.from(CRED_TABLE).upsert(
    {
      organization_id: organizationId,
      qbo_access_token: tokens.accessToken,
      qbo_refresh_token: tokens.refreshToken,
      qbo_token_expires_at: tokens.expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (credError) return { ok: false, message: credError.message };

  // Non-secret status → organizations.
  const { error } = await supabase
    .from("organizations")
    .update({
      qbo_realm_id: tokens.realmId,
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
 * Re-persist only the refreshed tokens (called from the lazy-refresh path
 * inside qboFetch). Writes solely to the credentials table via the admin
 * client; doesn't touch `qbo_connected_at` / `qbo_last_sync_error`.
 */
export async function persistRefreshedTokens(
  _supabase: SupabaseClient,
  organizationId: string,
  tokens: QboTokens,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from(CRED_TABLE).upsert(
    {
      organization_id: organizationId,
      qbo_access_token: tokens.accessToken,
      qbo_refresh_token: tokens.refreshToken,
      qbo_token_expires_at: tokens.expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
}

export async function clearQboConnection(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<void> {
  // Delete the secret credentials, then clear the non-secret status.
  const admin = createSupabaseAdminClient();
  await admin.from(CRED_TABLE).delete().eq("organization_id", organizationId);

  await supabase
    .from("organizations")
    .update({
      qbo_realm_id: null,
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
