import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type RoutingMode = "auto" | "manual";

/**
 * Sprint 1.5 — fetch the org's Smart Delivery Mode setting. New orgs
 * default to 'auto'. Existing orgs that were pre-flipped to 'manual'
 * by the migration (because they already had routes at deploy time)
 * stay there until the operator opts in.
 *
 * Returns 'auto' in demo mode so the new noob-friendly defaults are
 * what the sales-demo page shows.
 */
export async function getRoutingMode(): Promise<RoutingMode> {
  if (!hasSupabaseEnv()) return "auto";

  const ctx = await getOrgContext();
  if (!ctx) return "auto";

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organizations")
    .select("routing_mode")
    .eq("id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  const value = (data?.routing_mode as string | null) ?? "auto";
  return value === "manual" ? "manual" : "auto";
}
