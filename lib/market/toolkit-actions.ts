"use server";

import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { mergeOrgSettings } from "@/lib/settings/merge-settings";

/**
 * Marketplace-mode escape hatch: flips organizations.settings
 * .full_toolkit so a marketplace_seller org gets the complete operator
 * dashboard (storefront, routing, CRM, invoicing). Runs as the signed-
 * in user — RLS owner/admin write policies gate who can flip it.
 */
export async function unlockFullToolkit(): Promise<void> {
  if (!hasSupabaseEnv()) redirect("/dashboard");
  const ctx = await getOrgContext();
  if (!ctx) redirect("/market/sell");

  const supabase = await createSupabaseServerClient();
  await mergeOrgSettings(supabase, ctx.organizationId, { full_toolkit: true });
  redirect("/dashboard");
}
