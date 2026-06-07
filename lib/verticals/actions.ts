"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listVerticalSlugs } from "@/lib/verticals/registry";
import { logAppError, logAppEvent } from "@/lib/observability/server";

/**
 * Phase 4d — add a vertical to the active org.
 *
 * Inserts a row on organization_verticals (#291) with
 * is_primary = false so the org's existing primary vertical isn't
 * disturbed. Owners only — the RLS policy already enforces this, but
 * we short-circuit at the action level so the operator gets a clean
 * "Only owners can manage verticals" message instead of a generic
 * RLS rejection.
 *
 * Slug is validated against the registry so a typo or a removed
 * vertical can't land in the join table. ON CONFLICT DO NOTHING
 * keeps the action idempotent — re-adding a vertical the org
 * already declares is a no-op (no error).
 */

export type AddVerticalState = {
  ok: boolean;
  message: string;
};

export async function addOrgVertical(
  _prevState: AddVerticalState,
  formData: FormData,
): Promise<AddVerticalState> {
  const slugInput = String(formData.get("vertical_slug") ?? "").trim();

  // Validate against the registry. Rejecting outside-registry slugs
  // here is cheaper than hitting the DB only to get a constraint
  // failure on the per-vertical category-seed branch downstream.
  const allowedSlugs = listVerticalSlugs();
  if (!allowedSlugs.includes(slugInput)) {
    return {
      ok: false,
      message: "Pick a vertical from the list.",
    };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: would add "${slugInput}" to this org.`,
    };
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      message: "You must be signed in to manage verticals.",
    };
  }

  // Active owner membership lookup. The same shape the RLS policy on
  // organization_verticals uses, so any miss here would also fail RLS
  // — but checking up front gives the operator a readable message
  // instead of a generic permission error.
  const { data: ownership } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("profile_id", user.id)
    .eq("role", "owner")
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!ownership?.organization_id) {
    return {
      ok: false,
      message: "Only org owners can add verticals.",
    };
  }

  const { error } = await supabase
    .from("organization_verticals")
    .insert({
      organization_id: ownership.organization_id,
      vertical_slug: slugInput,
      is_primary: false,
    });

  if (error) {
    // 23505 = unique_violation — the row already exists. Treat as
    // a no-op success so the operator doesn't see a confusing
    // "already exists" error.
    if (error.code === "23505") {
      return { ok: true, message: "Vertical already added." };
    }
    await logAppError({
      organizationId: ownership.organization_id,
      source: "verticals.add",
      message: "Failed to add organization vertical",
      context: { reason: error.message, slug: slugInput },
      error,
    });
    return { ok: false, message: "Couldn't add that vertical. Try again." };
  }

  await logAppEvent({
    organizationId: ownership.organization_id,
    source: "verticals.add",
    action: "added",
    status: "success",
    metadata: { vertical_slug: slugInput },
  });

  // Refresh the settings page so the new chip shows up without a
  // hard reload. Other consumers (dashboard empty states) re-fetch
  // on their next navigation; no need to invalidate them here.
  revalidatePath("/dashboard/settings");

  return { ok: true, message: `Added "${slugInput}".` };
}
