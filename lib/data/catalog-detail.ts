import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getStorefrontFallbackGallery,
  getStorefrontFallbackImage,
} from "@/lib/media/storefront-fallback-images";
import { getOrgContext, getPublicOrgId } from "@/lib/auth/org-context";
import type { CatalogDetail } from "@/lib/types";
import { notFound } from "next/navigation";

const fallbackProducts: Record<string, CatalogDetail> = {
  "castle-bouncer": {
    id: "prod_castle_bouncer",
    name: "[DEMO] Castle Bouncer",
    slug: "castle-bouncer",
    category: "Bounce House",
    price: "$165/day",
    description:
      "Classic inflatable for backyard birthdays and neighborhood events.",
    highlights: [
      "Setup area: grass preferred, flat and clear",
      "Power: dedicated outlet or generator",
      "Includes: blower, stakes, and safety overview",
      "Turnaround and cleaning buffers enabled",
    ],
    imageUrl: getStorefrontFallbackImage("castle-bouncer", "Bounce House"),
    galleryImages: getStorefrontFallbackGallery(
      "castle-bouncer",
      "Bounce House"
    ),
  },
  "mega-splash-water-slide": {
    id: "prod_mega_splash",
    name: "[DEMO] Mega Splash Water Slide",
    slug: "mega-splash-water-slide",
    category: "Water Slide",
    price: "$279/day",
    description:
      "Premium slide with delivery-first setup workflow and deposit support.",
    highlights: [
      "Setup area: grass preferred, flat and clear",
      "Power: dedicated outlet or generator",
      "Includes: blower, stakes, and safety overview",
      "Turnaround and cleaning buffers enabled",
    ],
    imageUrl: getStorefrontFallbackImage(
      "mega-splash-water-slide",
      "Water Slide"
    ),
    galleryImages: getStorefrontFallbackGallery(
      "mega-splash-water-slide",
      "Water Slide"
    ),
  },
  "tropical-combo": {
    id: "prod_tropical_combo",
    name: "[DEMO] Tropical Combo",
    slug: "tropical-combo",
    category: "Combo Unit",
    price: "$235/day",
    description:
      "Balanced combo unit for families that want variety without full obstacle size.",
    highlights: [
      "Setup area: flat surface with clearance",
      "Power: one dedicated outlet",
      "Includes: blower, anchors, and safety overview",
      "Best for mixed-age family events",
    ],
    imageUrl: getStorefrontFallbackImage("tropical-combo", "Combo Unit"),
    galleryImages: getStorefrontFallbackGallery(
      "tropical-combo",
      "Combo Unit"
    ),
  },
};

export async function getCatalogDetail(slug: string): Promise<CatalogDetail> {
  if (!hasSupabaseEnv()) {
    return (
      fallbackProducts[slug] ?? fallbackProducts["mega-splash-water-slide"]
    );
  }

  // Resolve org: authenticated user context or public tenant hostname
  const ctx = await getOrgContext();
  const organizationId = ctx?.organizationId ?? (await getPublicOrgId());
  if (!organizationId) {
    return (
      fallbackProducts[slug] ?? fallbackProducts["mega-splash-water-slide"]
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, base_price, short_description, description, deleted_at, categories(name, deleted_at), product_attributes(attribute_key, attribute_value, deleted_at), product_images(image_url, is_primary, sort_order, deleted_at)"
    )
    .eq("organization_id", organizationId)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    notFound();
  }

  const category = (data as Record<string, unknown>).categories as
    | { name: string; deleted_at?: string | null }
    | null;

  const attributes =
    ((data as Record<string, unknown>).product_attributes as
      | {
          attribute_key: string;
          attribute_value: string;
          deleted_at?: string | null;
        }[]
      | null) ?? [];

  const activeAttributes = attributes.filter((attribute) => !attribute.deleted_at);

  const images =
    ((data as Record<string, unknown>).product_images as
      | {
          image_url: string;
          is_primary?: boolean;
          sort_order?: number;
          deleted_at?: string | null;
        }[]
      | null) ?? [];

  const activeImages = images.filter((image) => !image.deleted_at);

  const sortedImages = [...activeImages].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  const highlights =
    activeAttributes.length > 0
      ? activeAttributes.map(
          (a) =>
            `${a.attribute_key
              .replace(/_/g, " ")
              .replace(/\b\w/g, (c: string) => c.toUpperCase())}: ${a.attribute_value}`
        )
      : [
          "Setup area: grass preferred, flat and clear",
          "Power: dedicated outlet or generator",
          "Includes: blower, anchors, and safety overview",
          "Turnaround and cleaning buffers enabled",
        ];

  const resolvedCategory =
    category && !category.deleted_at ? category.name : "Inflatable";

  const fallbackImage = getStorefrontFallbackImage(
    data.slug ?? slug,
    resolvedCategory
  );
  const fallbackGallery = getStorefrontFallbackGallery(
    data.slug ?? slug,
    resolvedCategory
  );

  return {
    id: data.id,
    name: data.name ?? "Unnamed Product",
    slug: data.slug ?? slug,
    category: resolvedCategory,
    price:
      typeof data.base_price === "number"
        ? `$${data.base_price}/day`
        : "$0/day",
    description:
      data.description ??
      data.short_description ??
      "Inflatable rental product ready for booking.",
    highlights,
    imageUrl: sortedImages[0]?.image_url ?? fallbackImage,
    galleryImages:
      sortedImages.length > 0
        ? sortedImages.map((image) => image.image_url).filter(Boolean)
        : fallbackGallery,
  };
}
