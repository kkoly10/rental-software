import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type ProductAsset = {
  id: string;
  assetTag: string;
  operationalStatus: string;
  conditionStatus: string;
  createdAt: string;
  isAvailable: boolean;
};

const AVAILABLE_STATUSES = new Set(["ready", "available", "active"]);

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
    .select("id, asset_tag, operational_status, condition_status, created_at")
    .eq("organization_id", ctx.organizationId)
    .eq("product_id", productId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id,
    assetTag: row.asset_tag ?? "",
    operationalStatus: row.operational_status ?? "ready",
    conditionStatus: row.condition_status ?? "good",
    createdAt: row.created_at ?? "",
    isAvailable: AVAILABLE_STATUSES.has(row.operational_status ?? ""),
  }));
}
