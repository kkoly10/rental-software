"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

/**
 * Light-weight server-side query to fetch the current organization's subscription
 * status. Used by dashboard pages to pass to DashboardShell for the subscription
 * enforcement banner.
 */
export async function getSubscriptionStatus(): Promise<string | null> {
  if (!hasSupabaseEnv()) return null;

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("subscription_status")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  return org?.subscription_status ?? null;
}
