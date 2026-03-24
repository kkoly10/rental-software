import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const fallbackProducts = {
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
  },
} as const;

export async function getCatalogDetail(slug: string) {
  if (!hasSupabaseEnv()) {
    return fallbackProducts[slug as keyof typeof fallbackProducts] ?? fallbackProducts["mega-splash-water-slide"];
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, base_price, short_description, description")
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) {
    return fallbackProducts[slug as keyof typeof fallbackProducts] ?? fallbackProducts["mega-splash-water-slide"];
  }

  return {
    id: data.id,
    name: data.name ?? "Unnamed Product",
    slug: data.slug ?? slug,
    category: "Inflatable",
    price: typeof data.base_price === "number" ? `$${data.base_price}/day` : "$0/day",
    description: data.description ?? data.short_description ?? "Inflatable rental product ready for booking.",
    highlights: [
      "Setup area: grass preferred, flat and clear",
      "Power: dedicated outlet or generator",
      "Includes: blower, anchors, and safety overview",
      "Turnaround and cleaning buffers enabled",
    ],
  };
}
