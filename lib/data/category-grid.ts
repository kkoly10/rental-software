import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";

export type CategoryGridItem = {
  name: string;
  slug: string;
  imageUrl: string | null;
  startingPrice: number | null;
};

export async function getCategoryGridItems(): Promise<CategoryGridItem[]> {
  if (!hasSupabaseEnv()) return [];

  const organizationId = await getPublicOrgId();
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

  // Single query for all active products in any of these categories — replaces
  // the previous per-category N+1 round trip.
  const categoryIds = categories.map((c) => c.id);
  const { data: products } = await supabase
    .from("products")
    .select("category_id, base_price, product_images(image_url, deleted_at)")
    .in("category_id", categoryIds)
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("base_price", { ascending: true });

  type ProductRow = {
    category_id: string;
    base_price: number | string | null;
    product_images: { image_url: string; deleted_at?: string | null }[] | null;
  };
  const byCategory = new Map<string, ProductRow[]>();
  for (const p of (products ?? []) as ProductRow[]) {
    if (!p.category_id) continue;
    const list = byCategory.get(p.category_id) ?? [];
    list.push(p);
    byCategory.set(p.category_id, list);
  }

  const items: CategoryGridItem[] = [];
  for (const cat of categories) {
    const group = byCategory.get(cat.id);
    if (!group || group.length === 0) continue;

    const startingPrice = group[0]?.base_price ?? null;

    let imageUrl: string | null = null;
    for (const p of group) {
      const imgs = p.product_images?.filter((img) => !img.deleted_at);
      if (imgs && imgs.length > 0) {
        imageUrl = imgs[0].image_url;
        break;
      }
    }

    items.push({
      name: cat.name,
      slug: cat.slug,
      imageUrl,
      startingPrice:
        startingPrice !== null && startingPrice !== undefined
          ? Number(startingPrice)
          : null,
    });
  }

  return items;
}
