import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Atomically merge a patch of top-level keys into organizations.settings via
 * the merge_org_settings RPC (single UPDATE, no lost-update race).
 *
 * Falls back to a non-atomic read-modify-write if the RPC isn't available yet
 * (e.g. the migration hasn't been applied), so settings saves never break.
 * Pass ONLY the keys this writer changes — not the whole settings blob.
 */
export async function mergeOrgSettings(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  orgId: string,
  patch: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase.rpc("merge_org_settings", {
    p_org_id: orgId,
    p_patch: patch,
  });
  if (!error) return { ok: true };

  // Fallback: RPC missing/unavailable — preserve prior behavior.
  const { data } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  const existing = (data?.settings as Record<string, unknown>) ?? {};
  const { error: writeErr } = await supabase
    .from("organizations")
    .update({ settings: { ...existing, ...patch } })
    .eq("id", orgId)
    .is("deleted_at", null);
  return writeErr ? { ok: false, message: writeErr.message } : { ok: true };
}
