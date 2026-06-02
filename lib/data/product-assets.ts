import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { BOOKABLE_ASSET_STATUSES } from "@/lib/assets/operational-status";

export type ProductAsset = {
  id: string;
  assetTag: string;
  operationalStatus: string;
  conditionStatus: string;
  // Updated-at is the closest proxy to "added" we have — the assets table
  // schema only has updated_at + deleted_at (added in migration
  // 20260327_020000_updated_at_soft_delete_foundation.sql); created_at was
  // never added. On insert, updated_at defaults to now(), so for a freshly
  // added unit this is exactly "added at".
  updatedAt: string;
  isAvailable: boolean;
};

const AVAILABLE_STATUSES = new Set<string>(BOOKABLE_ASSET_STATUSES);

/**
 * Fetch all (non-deleted) assets for a product, scoped to the caller's org.
 */
export async function getProductAssets(productId: string): Promise<ProductAsset[]> {
  if (!hasSupabaseEnv()) return [];

  const ctx = await getOrgContext();
  if (!ctx) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assets")
    .select("id, asset_tag, operational_status, condition_status, updated_at")
    .eq("organization_id", ctx.organizationId)
    .eq("product_id", productId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: true })
    .limit(500);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    assetTag: row.asset_tag ?? "",
    operationalStatus: row.operational_status ?? "ready",
    conditionStatus: row.condition_status ?? "good",
    updatedAt: row.updated_at ?? "",
    isAvailable: AVAILABLE_STATUSES.has(row.operational_status ?? ""),
  }));
}
