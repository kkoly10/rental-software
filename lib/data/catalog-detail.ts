import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CatalogDetail } from "@/lib/types";

const fallbackProducts: Record<string, CatalogDetail> = {
  "castle-bouncer": {
    id: "prod_castle_bouncer",
    name: "Castle Bouncer",
    slug: "castle-bouncer",
    category: "Bounce House",
    price: "$165/day",
    description: "Classic inflatable for backyard birthdays and neighborhood events.",
    highlights: [
      "Setup area: grass preferred, flat and clear",
      "Power: dedicated outlet or generator",
      "Includes: blower, stakes, and safety overview",
      "Turnaround and cleaning buffers enabled",
    ],
    images: [],
  },
  "mega-splash-water-slide": {
    id: "prod_mega_splash",
    name: "Mega Splash Water Slide",
    slug: "mega-splash-water-slide",
    category: "Water Slide",
    price: "$279/day",
    description: "Premium slide with delivery-first setup workflow and deposit support.",
    highlights: [
      "Setup area: grass preferred, flat and clear",
      "Power: dedicated outlet or generator",
      "Includes: blower, stakes, and safety overview",
      "Turnaround and cleaning buffers enabled",
    ],
    images: [],
  },
  "tropical-combo": {
    id: "prod_tropical_combo",
    name: "Tropical Combo",
    slug: "tropical-combo",
    category: "Combo Unit",
    price: "$235/day",
    description: "Balanced combo unit for families that want variety without full obstacle size.",
    highlights: [
      "Setup area: flat surface with clearance",
      "Power: one dedicated outlet",
      "Includes: blower, anchors, and safety overview",
      "Best for mixed-age family events",
    ],
    images: [],
  },
};

export async function getCatalogDetail(slug: string): Promise<CatalogDetail> {
  if (!hasSupabaseEnv()) {
    return fallbackProducts[slug] ?? fallbackProducts["mega-splash-water-slide"];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, base_price, short_description, description, categories(name), product_attributes(attribute_key, attribute_value), product_images(image_url, alt_text, sort_order, is_primary)")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    return fallbackProducts[slug] ?? fallbackProducts["mega-splash-water-slide"];
  }

  const category = (data as Record<string, unknown>).categories as { name: string } | null;
  const attributes = ((data as Record<string, unknown>).product_attributes as { attribute_key: string; attribute_value: string }[] | null) ?? [];
  const rawImages = ((data as Record<string, unknown>).product_images as { image_url: string; alt_text: string | null; sort_order: number; is_primary: boolean }[] | null) ?? [];

  const highlights = attributes.length > 0
    ? attributes.map((a) => `${a.attribute_key.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}: ${a.attribute_value}`)
    : [
        "Setup area: grass preferred, flat and clear",
        "Power: dedicated outlet or generator",
        "Includes: blower, anchors, and safety overview",
        "Turnaround and cleaning buffers enabled",
      ];

  const sortedImages = [...rawImages].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return a.sort_order - b.sort_order;
  });

  return {
    id: data.id,
    name: data.name ?? "Unnamed Product",
    slug: data.slug ?? slug,
    category: category?.name ?? "Inflatable",
    price: typeof data.base_price === "number" ? `$${data.base_price}/day` : "$0/day",
    description: data.description ?? data.short_description ?? "Inflatable rental product ready for booking.",
    highlights,
    images: sortedImages.map((img) => ({ url: img.image_url, alt: img.alt_text ?? "" })),
  };
}
