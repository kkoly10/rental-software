import "server-only";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { hasQuickBooksEnv } from "@/lib/integrations/quickbooks/config";

/**
 * Settings → Integrations status snapshot for the QuickBooks card.
 *
 * Returns enough data to render the connect / disconnect button and
 * surface the last sync time (or error) without exposing the OAuth
 * tokens themselves. Keep tokens off this read path so the card UI
 * can't accidentally leak them client-side.
 */
export type QuickBooksStatus =
  | { configured: false }
  | {
      configured: true;
      connected: false;
    }
  | {
      configured: true;
      connected: true;
      realmId: string;
      connectedAt: string | null;
      lastSyncAt: string | null;
      lastSyncError: string | null;
    };

export async function getQuickBooksStatus(): Promise<QuickBooksStatus> {
  if (!hasQuickBooksEnv()) {
    return { configured: false };
  }
  if (!hasSupabaseEnv()) {
    return { configured: true, connected: false };
  }
  const ctx = await getOrgContext();
  if (!ctx) {
    return { configured: true, connected: false };
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select(
      "qbo_realm_id, qbo_connected_at, qbo_last_sync_at, qbo_last_sync_error",
    )
    .eq("id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  const row = data as Record<string, string | null> | null;
  if (!row?.qbo_realm_id) {
    return { configured: true, connected: false };
  }

  return {
    configured: true,
    connected: true,
    realmId: row.qbo_realm_id,
    connectedAt: row.qbo_connected_at ?? null,
    lastSyncAt: row.qbo_last_sync_at ?? null,
    lastSyncError: row.qbo_last_sync_error ?? null,
  };
}
