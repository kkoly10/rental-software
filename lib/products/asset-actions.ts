"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type AssetActionState = {
  ok: boolean;
  message: string;
};

const VALID_OPERATIONAL_STATUSES = [
  "ready",
  "available",
  "active",
  "maintenance",
  "broken",
  "retired",
] as const;
type OperationalStatus = (typeof VALID_OPERATIONAL_STATUSES)[number];

async function requireManager(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  profileId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("profile_id", profileId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(membership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to manage inventory." };
  }
  return { ok: true };
}

/**
 * Create a new asset for a product, owned by the caller's org. Always issues a
 * unique tag (the existing auto-create path uses the product slug which
 * collides on the (organization_id, asset_tag) unique index for any second
 * asset of the same product).
 */
export async function addProductAsset(
  _prev: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  if (!hasSupabaseEnv()) return { ok: true, message: "Demo mode: asset would be added." };

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const productId = String(formData.get("product_id") ?? "").trim();
  if (!productId) return { ok: false, message: "Missing product." };

  const supabase = await createSupabaseServerClient();
  const auth = await requireManager(supabase, ctx.organizationId, ctx.userId);
  if (!auth.ok) return auth;

  // Confirm the product belongs to this org.
  const { data: product } = await supabase
    .from("products")
    .select("id, slug, name")
    .eq("id", productId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!product) return { ok: false, message: "Product not found." };

  // Best-effort unique tag with a single retry on a 23505 collision.
  const slugPart = (product.slug ?? product.name ?? "asset")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .slice(0, 24)
    .replace(/^-|-$/g, "");

  const insertAsset = async () => {
    const tag = `${slugPart || "asset"}-${crypto.randomBytes(3).toString("hex")}`;
    return supabase
      .from("assets")
      .insert({
        organization_id: ctx.organizationId,
        product_id: productId,
        asset_tag: tag,
        operational_status: "ready",
        condition_status: "good",
      })
      .select("id")
      .single();
  };

  let { error } = await insertAsset();
  if (error && (error as { code?: string }).code === "23505") {
    ({ error } = await insertAsset());
  }
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/products/${productId}`);
  revalidatePath("/dashboard/products");
  revalidatePath("/inventory");
  if (product.slug) revalidatePath(`/inventory/${product.slug}`);
  return { ok: true, message: "Asset added." };
}

/**
 * Update an asset's operational status. Only assets whose parent product
 * belongs to the caller's org can be touched.
 */
export async function updateProductAssetStatus(
  _prev: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  if (!hasSupabaseEnv()) return { ok: true, message: "Demo mode: status would be updated." };

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const assetId = String(formData.get("asset_id") ?? "").trim();
  const newStatus = String(formData.get("operational_status") ?? "").trim() as OperationalStatus;
  const productId = String(formData.get("product_id") ?? "").trim();
  if (!assetId || !newStatus) return { ok: false, message: "Missing fields." };
  if (!(VALID_OPERATIONAL_STATUSES as readonly string[]).includes(newStatus)) {
    return { ok: false, message: "Invalid status." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requireManager(supabase, ctx.organizationId, ctx.userId);
  if (!auth.ok) return auth;

  const { error } = await supabase
    .from("assets")
    .update({ operational_status: newStatus })
    .eq("id", assetId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);
  if (error) return { ok: false, message: error.message };

  if (productId) revalidatePath(`/dashboard/products/${productId}`);
  revalidatePath("/dashboard/products");
  revalidatePath("/inventory");
  await revalidateInventorySlug(supabase, ctx.organizationId, productId);
  return { ok: true, message: "Status updated." };
}

/**
 * Soft-delete an asset (sets deleted_at). The asset disappears from
 * availability counts immediately.
 */
export async function removeProductAsset(
  _prev: AssetActionState,
  formData: FormData
): Promise<AssetActionState> {
  if (!hasSupabaseEnv()) return { ok: true, message: "Demo mode: asset would be removed." };

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const assetId = String(formData.get("asset_id") ?? "").trim();
  const productId = String(formData.get("product_id") ?? "").trim();
  if (!assetId) return { ok: false, message: "Missing asset id." };

  const supabase = await createSupabaseServerClient();
  const auth = await requireManager(supabase, ctx.organizationId, ctx.userId);
  if (!auth.ok) return auth;

  const { error } = await supabase
    .from("assets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", assetId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);
  if (error) return { ok: false, message: error.message };

  if (productId) revalidatePath(`/dashboard/products/${productId}`);
  revalidatePath("/dashboard/products");
  revalidatePath("/inventory");
  await revalidateInventorySlug(supabase, ctx.organizationId, productId);
  return { ok: true, message: "Asset removed." };
}

async function revalidateInventorySlug(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  productId: string
): Promise<void> {
  if (!productId) return;
  const { data } = await supabase
    .from("products")
    .select("slug")
    .eq("id", productId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (data?.slug) revalidatePath(`/inventory/${data.slug}`);
}
