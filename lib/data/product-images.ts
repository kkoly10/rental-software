import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type ProductImageRecord = {
  id: string;
  imageUrl: string;
  altText: string;
  isPrimary: boolean;
  sortOrder: number;
};

export async function getProductImages(
  productId: string
): Promise<ProductImageRecord[]> {
  if (!hasSupabaseEnv()) {
    return [];
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_images")
    .select(
      "id, image_url, alt_text, is_primary, sort_order, products!inner(organization_id)"
    )
    .eq("product_id", productId)
    .eq("products.organization_id", ctx.organizationId)
    .order("is_primary", { ascending: false })
    .order("sort_order", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((image) => ({
    id: image.id,
    imageUrl: image.image_url ?? "",
    altText: image.alt_text ?? "Product image",
    isPrimary: image.is_primary ?? false,
    sortOrder: image.sort_order ?? 0,
  }));
}
