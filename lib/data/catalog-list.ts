import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CatalogProduct } from "@/lib/types";

const fallbackCatalog: CatalogProduct[] = [
  {
    id: "prod_castle_bouncer",
    name: "Castle Bouncer",
    slug: "castle-bouncer",
    category: "Bounce House",
    price: "$165/day",
    description: "Classic inflatable for backyard birthdays and neighborhood events.",
    status: "Available",
    imageUrl: null,
  },
  {
    id: "prod_mega_splash",
    name: "Mega Splash Water Slide",
    slug: "mega-splash-water-slide",
    category: "Water Slide",
    price: "$279/day",
    description: "Premium slide with delivery-first setup workflow and deposit support.",
    status: "Available",
    imageUrl: null,
  },
  {
    id: "prod_tropical_combo",
    name: "Tropical Combo",
    slug: "tropical-combo",
    category: "Combo Unit",
    price: "$235/day",
    description: "Balanced combo unit for families that want variety without full obstacle size.",
    status: "Limited",
    imageUrl: null,
  },
];

export async function getCatalogList(categorySlug?: string): Promise<CatalogProduct[]> {
  if (!hasSupabaseEnv()) {
    if (categorySlug) {
      const slug = categorySlug.toLowerCase();
      return fallbackCatalog.filter((p) => p.category.toLowerCase().replace(/\s+/g, "-") === slug);
    }
    return fallbackCatalog;
  }

  const supabase = await createSupabaseServerClient();

  const catJoin = categorySlug ? "categories!inner(name, slug)" : "categories(name)";
  let query = supabase
    .from("products")
    .select(`id, name, slug, base_price, short_description, is_active, ${catJoin}, product_images(image_url, is_primary, sort_order)`)
    .eq("visibility", "public")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (categorySlug) {
    query = query.eq("categories.slug", categorySlug);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return fallbackCatalog;
  }

  return data.map((product) => {
    const images = ((product as Record<string, unknown>).product_images as { image_url: string; is_primary: boolean; sort_order: number }[] | null) ?? [];
    const primary = images.find((i) => i.is_primary) ?? images.sort((a, b) => a.sort_order - b.sort_order)[0];
    return {
      id: product.id,
      name: product.name ?? "Unnamed Product",
      slug: product.slug ?? "product",
      category: (product as Record<string, unknown>).categories
        ? ((product as Record<string, unknown>).categories as { name: string })?.name ?? "Inflatable"
        : "Inflatable",
      price: typeof product.base_price === "number" ? `$${product.base_price}/day` : "$0/day",
      description: product.short_description ?? "Inflatable rental product ready for public booking.",
      status: product.is_active ? "Available" : "Hidden",
      imageUrl: primary?.image_url ?? null,
    };
  });
}

export async function getFeaturedCatalogList(): Promise<CatalogProduct[]> {
  const products = await getCatalogList();
  return products.slice(0, 4);
}

export async function getPublicCategories(): Promise<{ name: string; slug: string }[]> {
  const fallback = [
    { name: "Bounce House", slug: "bounce-houses" },
    { name: "Water Slide", slug: "water-slides" },
    { name: "Combo Unit", slug: "combos" },
    { name: "Add-on", slug: "add-ons" },
  ];

  if (!hasSupabaseEnv()) return fallback;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("name, slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) return fallback;
  return data.map((c) => ({ name: c.name, slug: c.slug }));
}
