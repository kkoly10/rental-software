import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorefrontFallbackImage } from "@/lib/media/storefront-fallback-images";
import { getPublicOrgId } from "@/lib/auth/org-context";
import type { CatalogProduct } from "@/lib/types";

/**
 * Format a card's price to match the product's real pricing model — mirrors
 * the PDP, which already shows per-hour / per-unit correctly. Cards previously
 * always said "$X/day" even for per-hour or per-unit products. Returns both the
 * display string and a numeric `priceCents` so catalog sort uses a real number
 * instead of re-parsing the formatted string. `base_price` is in dollars; the
 * hourly/unit rates are in cents.
 */
function formatPricing(p: {
  base_price: number | null;
  capability_slugs: string[] | null;
  hourly_rate_cents: number | null;
  unit_price_cents: number | null;
  unit_label: string | null;
}): { price: string; priceCents: number } {
  const slugs = Array.isArray(p.capability_slugs) ? p.capability_slugs : [];
  const money = (cents: number) =>
    `$${(cents / 100).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;

  if (
    slugs.includes("pricing.per-hour") &&
    typeof p.hourly_rate_cents === "number" &&
    p.hourly_rate_cents > 0
  ) {
    return { price: `${money(p.hourly_rate_cents)}/hr`, priceCents: p.hourly_rate_cents };
  }

  if (
    slugs.includes("pricing.per-unit") &&
    typeof p.unit_price_cents === "number" &&
    p.unit_price_cents > 0
  ) {
    const label = p.unit_label?.trim() || "unit";
    return { price: `${money(p.unit_price_cents)}/${label}`, priceCents: p.unit_price_cents };
  }

  if (typeof p.base_price === "number") {
    return { price: `$${p.base_price}/day`, priceCents: Math.round(p.base_price * 100) };
  }

  return { price: "$0/day", priceCents: 0 };
}

const fallbackCatalog: CatalogProduct[] = [
  {
    id: "prod_castle_bouncer",
    name: "[DEMO] Castle Bouncer",
    slug: "castle-bouncer",
    category: "Bounce House",
    price: "$165/day",
    priceCents: 16500,
    description:
      "Classic inflatable for backyard birthdays and neighborhood events.",
    status: "Available",
    imageUrl: getStorefrontFallbackImage("castle-bouncer", "Bounce House"),
  },
  {
    id: "prod_mega_splash",
    name: "[DEMO] Mega Splash Water Slide",
    slug: "mega-splash-water-slide",
    category: "Water Slide",
    price: "$279/day",
    priceCents: 27900,
    description:
      "Premium slide with delivery-first setup workflow and deposit support.",
    status: "Available",
    imageUrl: getStorefrontFallbackImage(
      "mega-splash-water-slide",
      "Water Slide"
    ),
  },
  {
    id: "prod_tropical_combo",
    name: "[DEMO] Tropical Combo",
    slug: "tropical-combo",
    category: "Combo Unit",
    price: "$235/day",
    priceCents: 23500,
    description:
      "Balanced combo unit for families that want variety without full obstacle size.",
    status: "Limited",
    imageUrl: getStorefrontFallbackImage("tropical-combo", "Combo Unit"),
  },
];

export async function getCatalogList(): Promise<CatalogProduct[]> {
  if (!hasSupabaseEnv()) {
    return fallbackCatalog;
  }

  const organizationId = await getPublicOrgId();
  if (!organizationId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, base_price, capability_slugs, hourly_rate_cents, unit_price_cents, unit_label, short_description, is_active, deleted_at, categories(name, deleted_at), product_images(image_url, is_primary, sort_order, deleted_at)"
    )
    .eq("organization_id", organizationId)
    .eq("visibility", "public")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    // Explicit cap so any catalog past this size is observable rather than
    // silently truncated by PostgREST's default 1000-row limit.
    .limit(2000);

  if (error) {
    console.error("[catalog-list] Failed to fetch products:", error.message);
    throw new Error("Failed to load catalog. Please try again.");
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((product) => {
    const category = (product as Record<string, unknown>).categories as
      | { name: string; deleted_at?: string | null }
      | null;

    const images =
      ((product as Record<string, unknown>).product_images as
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

    const resolvedCategory =
      category && !category.deleted_at ? category.name : "Rental";

    const p = product as Record<string, unknown>;
    const pricing = formatPricing({
      base_price: typeof product.base_price === "number" ? product.base_price : null,
      capability_slugs: Array.isArray(p.capability_slugs) ? (p.capability_slugs as string[]) : null,
      hourly_rate_cents: typeof p.hourly_rate_cents === "number" ? (p.hourly_rate_cents as number) : null,
      unit_price_cents: typeof p.unit_price_cents === "number" ? (p.unit_price_cents as number) : null,
      unit_label: typeof p.unit_label === "string" ? (p.unit_label as string) : null,
    });

    return {
      id: product.id,
      name: product.name ?? "Unnamed Product",
      slug: product.slug ?? "product",
      category: resolvedCategory,
      price: pricing.price,
      priceCents: pricing.priceCents,
      description:
        product.short_description ??
        "Rental product available for booking.",
      status: product.is_active ? "Available" : "Hidden",
      imageUrl:
        sortedImages[0]?.image_url ??
        getStorefrontFallbackImage(product.slug ?? undefined, resolvedCategory),
    };
  });
}

export async function getFeaturedCatalogList(): Promise<CatalogProduct[]> {
  const products = await getCatalogList();
  return products.slice(0, 4);
}