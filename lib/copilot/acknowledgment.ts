import type { SupabaseClient } from "@supabase/supabase-js";

// Bump this when the terms text materially changes — operators are re-prompted
// to acknowledge the new version (the row is unique per org+user+version).
export const COPILOT_ACTIONS_TERMS_VERSION = "2026-06-04";

export const COPILOT_ACTIONS_TERMS = [
  "Before the Operator Copilot performs actions on your behalf, please acknowledge:",
  "",
  "• The Copilot is an AI assistant. It only acts when you explicitly confirm an action (e.g. recording a payment), and you are responsible for reviewing each action before confirming.",
  "• Confirmed actions are performed under your account and are recorded with your identity, the date and time, and an attribution that the action was taken via the Copilot.",
  "• You remain responsible for the accuracy of your records. The Copilot does not provide legal, tax, or accounting advice.",
].join("\n");

const ACK_TABLE = "copilot_action_acknowledgments";

// Postgres "undefined_table" — the acknowledgment migration hasn't been applied
// to this database yet. We treat that as "not provisioned" and fail open so the
// Copilot keeps working; the gate activates automatically once the table exists.
function isMissingTable(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01";
}

export async function hasAcknowledgedCopilotActions(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  version: string
): Promise<{ acknowledged: boolean; provisioned: boolean }> {
  const { data, error } = await supabase
    .from(ACK_TABLE)
    .select("id")
    .eq("organization_id", organizationId)
    .eq("profile_id", userId)
    .eq("version", version)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      return { acknowledged: true, provisioned: false };
    }
    // Unknown/transient error: fail closed. The acknowledgment is a
    // legal/audit control; treating a DB hiccup as "acknowledged" lets
    // the gate bypass on any transient outage. The route surfaces the
    // re-prompt and the operator retries.
    return { acknowledged: false, provisioned: true };
  }

  return { acknowledged: Boolean(data), provisioned: true };
}

export async function recordCopilotActionAcknowledgment(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  version: string,
  ip: string | null,
  userAgent: string | null
): Promise<{ ok: boolean; provisioned: boolean }> {
  const { error } = await supabase.from(ACK_TABLE).upsert(
    {
      organization_id: organizationId,
      profile_id: userId,
      version,
      ip,
      user_agent: userAgent,
    },
    { onConflict: "organization_id,profile_id,version", ignoreDuplicates: true }
  );

  if (error) {
    if (isMissingTable(error)) return { ok: true, provisioned: false };
    return { ok: false, provisioned: true };
  }
  return { ok: true, provisioned: true };
}
