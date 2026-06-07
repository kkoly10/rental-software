"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getVertical, listVerticalSlugs } from "@/lib/verticals/registry";
import {
  nextSortOrders,
  slugifyCategoryName,
} from "@/lib/verticals/category-seed";
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

  // Phase 4h — when an operator adds a vertical, also seed the
  // matching defaultCategorySeeds from the registry so the new line
  // of business has something to bucket products under. Best-effort:
  // any insert failure here logs but doesn't fail the action — the
  // org_verticals row is the canonical "this org rents X" answer; a
  // missing category just means the operator has to create one
  // manually, not that the whole add gets reverted.
  let seededCategories = 0;
  const vertical = getVertical(slugInput);
  if (vertical && vertical.defaultCategorySeeds.length > 0) {
    const { data: existing } = await supabase
      .from("categories")
      .select("slug")
      .eq("organization_id", ownership.organization_id)
      .is("deleted_at", null);
    const existingSlugs = new Set(
      (existing ?? []).map((r) => (r as { slug: string }).slug),
    );
    const { data: maxRow } = await supabase
      .from("categories")
      .select("sort_order")
      .eq("organization_id", ownership.organization_id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const startSort =
      typeof maxRow?.sort_order === "number" ? maxRow.sort_order : 0;
    const sortOrders = nextSortOrders(
      startSort,
      vertical.defaultCategorySeeds.length,
    );
    const rows = vertical.defaultCategorySeeds
      .map((name, idx) => ({
        organization_id: ownership.organization_id,
        name,
        slug: slugifyCategoryName(name),
        sort_order: sortOrders[idx],
        vertical: slugInput,
      }))
      .filter((row) => row.slug.length > 0 && !existingSlugs.has(row.slug));
    if (rows.length > 0) {
      const { error: catError } = await supabase
        .from("categories")
        .insert(rows);
      if (catError) {
        // Log but don't fail — see comment above.
        await logAppError({
          organizationId: ownership.organization_id,
          source: "verticals.add",
          message: "Failed to seed categories for added vertical",
          context: { reason: catError.message, slug: slugInput },
          error: catError,
        });
      } else {
        seededCategories = rows.length;
      }
    }
  }

  await logAppEvent({
    organizationId: ownership.organization_id,
    source: "verticals.add",
    action: "added",
    status: "success",
    metadata: { vertical_slug: slugInput, seeded_categories: seededCategories },
  });

  // Refresh the settings page so the new chip shows up without a
  // hard reload. Other consumers (dashboard empty states) re-fetch
  // on their next navigation; no need to invalidate them here.
  revalidatePath("/dashboard/settings");
  // New categories show up wherever the products dashboard reads from
  // — invalidate so the next visit reflects them.
  revalidatePath("/dashboard/products");

  const suffix =
    seededCategories > 0
      ? ` (+${seededCategories} starter ${seededCategories === 1 ? "category" : "categories"})`
      : "";
  return { ok: true, message: `Added "${slugInput}".${suffix}` };
}

/**
 * Phase 4f — remove a non-primary vertical.
 *
 * Counterpart to addOrgVertical. Refuses to remove the primary
 * (is_primary = true) row so an org always has a canonical answer
 * for surfaces that expect one (#288 / #289 empty states, #290
 * starter examples). The operator changes primary via a separate
 * action (out of scope here).
 *
 * Idempotent: removing a row that doesn't exist (e.g. concurrent
 * remove from two tabs) returns success, not an error.
 */
export type RemoveVerticalState = {
  ok: boolean;
  message: string;
};

export async function removeOrgVertical(
  _prevState: RemoveVerticalState,
  formData: FormData,
): Promise<RemoveVerticalState> {
  const slugInput = String(formData.get("vertical_slug") ?? "").trim();
  if (!slugInput) {
    return { ok: false, message: "Pick a vertical to remove." };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: would remove "${slugInput}".`,
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
      message: "Only org owners can remove verticals.",
    };
  }

  // Refuse to remove the primary row. Filtering is_primary = false
  // on the delete query is the security gate; a crafted slug for
  // the primary vertical just no-ops instead of leaving the org in
  // a no-primary state.
  const { error, count } = await supabase
    .from("organization_verticals")
    .delete({ count: "exact" })
    .eq("organization_id", ownership.organization_id)
    .eq("vertical_slug", slugInput)
    .eq("is_primary", false);

  if (error) {
    await logAppError({
      organizationId: ownership.organization_id,
      source: "verticals.remove",
      message: "Failed to remove organization vertical",
      context: { reason: error.message, slug: slugInput },
      error,
    });
    return { ok: false, message: "Couldn't remove that vertical. Try again." };
  }

  if ((count ?? 0) === 0) {
    // Either the row didn't exist (already removed) or it was the
    // primary (which the filter intentionally excludes). Both surface
    // as a friendly nudge so the operator understands why nothing
    // changed without making them re-read the docs.
    return {
      ok: true,
      message: "Nothing to remove — that vertical isn't a secondary one.",
    };
  }

  // Phase 4i — when a vertical is removed, also soft-delete any
  // EMPTY categories the system seeded for it. We only touch
  // categories with zero products so an operator who has real
  // inventory under (say) "Frame Tent" doesn't lose their bucket.
  // Best-effort: a failure logs but doesn't roll back the org_vertical
  // delete since the categories are recoverable (set deleted_at back
  // to null) but the vertical row is the source of truth.
  let archivedCategories = 0;
  const { data: candidateRows } = await supabase
    .from("categories")
    .select("id")
    .eq("organization_id", ownership.organization_id)
    .eq("vertical", slugInput)
    .is("deleted_at", null);
  const candidateIds = (candidateRows ?? []).map(
    (r) => (r as { id: string }).id,
  );
  if (candidateIds.length > 0) {
    const { data: usedRows } = await supabase
      .from("products")
      .select("category_id")
      .in("category_id", candidateIds)
      .is("deleted_at", null);
    const usedIds = new Set(
      (usedRows ?? [])
        .map((r) => (r as { category_id: string | null }).category_id)
        .filter((id): id is string => typeof id === "string"),
    );
    const archivableIds = candidateIds.filter((id) => !usedIds.has(id));
    if (archivableIds.length > 0) {
      const { error: archiveError } = await supabase
        .from("categories")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", archivableIds);
      if (archiveError) {
        await logAppError({
          organizationId: ownership.organization_id,
          source: "verticals.remove",
          message: "Failed to archive empty categories on vertical remove",
          context: { reason: archiveError.message, slug: slugInput },
          error: archiveError,
        });
      } else {
        archivedCategories = archivableIds.length;
      }
    }
  }

  await logAppEvent({
    organizationId: ownership.organization_id,
    source: "verticals.remove",
    action: "removed",
    status: "success",
    metadata: {
      vertical_slug: slugInput,
      archived_categories: archivedCategories,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard/products");
  const suffix =
    archivedCategories > 0
      ? ` (archived ${archivedCategories} empty ${archivedCategories === 1 ? "category" : "categories"})`
      : "";
  return { ok: true, message: `Removed "${slugInput}".${suffix}` };
}

/**
 * Phase 4g — promote a non-primary vertical to primary.
 *
 * Delegates to the set_primary_vertical RPC (migration
 * 20260608_160000) so the clear-then-set on is_primary happens in
 * one atomic statement-set; without that the partial unique index
 * organization_verticals_one_primary would briefly see two
 * primaries (or zero) and reject the second UPDATE.
 *
 * The RPC enforces ownership + "slug must exist for this org" so
 * this action just rewrites the raise-exception strings into a
 * friendlier UI message.
 */
export type SetPrimaryVerticalState = {
  ok: boolean;
  message: string;
};

export async function setPrimaryOrgVertical(
  _prevState: SetPrimaryVerticalState,
  formData: FormData,
): Promise<SetPrimaryVerticalState> {
  const slugInput = String(formData.get("vertical_slug") ?? "").trim();
  if (!slugInput) {
    return { ok: false, message: "Pick a vertical to promote." };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: would promote "${slugInput}".`,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_primary_vertical", {
    p_vertical_slug: slugInput,
  });

  if (error) {
    // The RPC raises with these prefixes; surface the user-facing
    // version without leaking the raw "P0001" Postgres detail.
    if (error.message.includes("Only org owners")) {
      return { ok: false, message: "Only org owners can change the primary." };
    }
    if (error.message.includes("not declared")) {
      return { ok: false, message: "That vertical isn't on this org yet — add it first." };
    }
    if (error.message.includes("Not authenticated")) {
      return { ok: false, message: "You must be signed in to manage verticals." };
    }
    await logAppError({
      source: "verticals.set_primary",
      message: "Failed to set primary vertical",
      context: { reason: error.message, slug: slugInput },
      error,
    });
    return { ok: false, message: "Couldn't change the primary. Try again." };
  }

  await logAppEvent({
    source: "verticals.set_primary",
    action: "promoted",
    status: "success",
    metadata: { vertical_slug: slugInput },
  });

  revalidatePath("/dashboard/settings");
  return { ok: true, message: `"${slugInput}" is now the primary vertical.` };
}
