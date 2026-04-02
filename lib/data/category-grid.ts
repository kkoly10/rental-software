import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext, getPublicOrgId } from "@/lib/auth/org-context";

export type CategoryGridItem = {
  name: string;
  slug: string;
  imageUrl: string | null;
  startingPrice: number | null;
};

export async function getCategoryGridItems(): Promise<CategoryGridItem[]> {
  if (!hasSupabaseEnv()) return [];

  const ctx = await getOrgContext();
  const organizationId = ctx?.organizationId ?? (await getPublicOrgId());
  if (!organizationId) return [];

  const supabase = await createSupabaseServerClient();

  // Fetch active categories that have at least one active product
  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, slug, sort_order")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .limit(6);

  if (error || !categories || categories.length === 0) return [];

  // For each category, get the lowest price and a representative image
  const items: CategoryGridItem[] = [];

  for (const cat of categories) {
    // Get cheapest active product and first product image in one go
    const { data: products } = await supabase
      .from("products")
      .select("base_price, product_images(image_url)")
      .eq("category_id", cat.id)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("base_price", { ascending: true })
      .limit(5);

    if (!products || products.length === 0) continue;

    const startingPrice = products[0]?.base_price ?? null;

    // Find the first product that has an image
    let imageUrl: string | null = null;
    for (const p of products) {
      const imgs = p.product_images as { image_url: string }[] | null;
      if (imgs && imgs.length > 0) {
        imageUrl = imgs[0].image_url;
        break;
      }
    }

    items.push({
      name: cat.name,
      slug: cat.slug,
      imageUrl,
      startingPrice: startingPrice ? Number(startingPrice) : null,
    });
  }

  return items;
}
