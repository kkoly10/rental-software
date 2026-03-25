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
  },
  {
    id: "prod_mega_splash",
    name: "Mega Splash Water Slide",
    slug: "mega-splash-water-slide",
    category: "Water Slide",
    price: "$279/day",
    description: "Premium slide with delivery-first setup workflow and deposit support.",
    status: "Available",
  },
  {
    id: "prod_tropical_combo",
    name: "Tropical Combo",
    slug: "tropical-combo",
    category: "Combo Unit",
    price: "$235/day",
    description: "Balanced combo unit for families that want variety without full obstacle size.",
    status: "Limited",
  },
];

export async function getCatalogList(): Promise<CatalogProduct[]> {
  if (!hasSupabaseEnv()) {
    return fallbackCatalog;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, base_price, short_description, is_active, categories(name)")
    .eq("visibility", "public")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error || !data || data.length === 0) {
    return fallbackCatalog;
  }

  return data.map((product) => ({
    id: product.id,
    name: product.name ?? "Unnamed Product",
    slug: product.slug ?? "product",
    category: (product as Record<string, unknown>).categories
      ? ((product as Record<string, unknown>).categories as { name: string })?.name ?? "Inflatable"
      : "Inflatable",
    price: typeof product.base_price === "number" ? `$${product.base_price}/day` : "$0/day",
    description: product.short_description ?? "Inflatable rental product ready for public booking.",
    status: product.is_active ? "Available" : "Hidden",
  }));
}

export async function getFeaturedCatalogList(): Promise<CatalogProduct[]> {
  const products = await getCatalogList();
  return products.slice(0, 4);
}
