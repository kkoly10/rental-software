import { cache } from "react";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import {
  getStorefrontFallbackGallery,
  getStorefrontFallbackImage,
} from "@/lib/media/storefront-fallback-images";
import { getPublicOrgId } from "@/lib/auth/org-context";
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

export const getCatalogDetail = cache(async function getCatalogDetail(slug: string): Promise<CatalogDetail> {
  if (!hasSupabaseEnv()) {
    return (
      fallbackProducts[slug] ?? fallbackProducts["mega-splash-water-slide"]
    );
  }

  const organizationId = await getPublicOrgId();
  if (!organizationId) {
    notFound();
  }

  // Same anon-RLS-RETURNING pattern as #111/#112/#115/#117 — the storefront
  // detail page runs anonymously, RLS on products/categories/etc. is gated
  // to org members, and the cookie-bound client returns null even for valid
  // public products. Org isolation enforced via .eq("organization_id", ...).
  const supabase = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();
  // product_attributes does NOT have a deleted_at column — migration
  // 20260327_020000_updated_at_soft_delete_foundation.sql only added it to
  // categories, product_images, and the other soft-delete-bearing tables;
  // product_attributes only got updated_at. Selecting a non-existent column
  // makes PostgREST error, .maybeSingle() returns null, and notFound() fires
  // on every product detail page. Every active product 404s.
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, base_price, supports_modes, wet_upcharge_cents, short_description, description, deleted_at, capability_slugs, hourly_rate_cents, minimum_hours, unit_price_cents, unit_label, minimum_order_quantity, capacity_metric, capacity_value, categories(name, deleted_at), product_attributes(attribute_key, attribute_value), product_images(image_url, is_primary, sort_order, deleted_at), product_specs(id, spec_key, spec_label, spec_value, display_order), product_variants(id, variant_label, thumbnail_url, preview_image_url, price_delta_cents, is_default, display_order), product_addons!parent_product_id(default_quantity, max_quantity, is_required, display_order, addon:products!addon_product_id(id, name, base_price))"
    )
    .eq("organization_id", organizationId)
    .eq("slug", slug)
    .eq("is_active", true)
    .eq("visibility", "public")
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
        }[]
      | null) ?? [];

  // No deleted_at column on product_attributes (see select comment above);
  // every row that comes back is active.
  const activeAttributes = attributes;

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
          "Professional delivery and setup included",
          "See your order confirmation for space requirements",
          "Our team reviews everything with you before we leave",
          "Contact us with any questions before your event",
        ];

  const resolvedCategory =
    category && !category.deleted_at ? category.name : "Rental";

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
      "Rental product available for booking.",
    highlights,
    imageUrl: sortedImages[0]?.image_url ?? fallbackImage,
    galleryImages:
      sortedImages.length > 0
        ? sortedImages.map((image) => image.image_url).filter(Boolean)
        : fallbackGallery,
    // Sprint 6.0 — inflatable wet/dry mode fields surface only when the
    // operator has configured them. The storefront treats absent or
    // single-mode products as "no toggle, render as today."
    supportsModes:
      Array.isArray((data as Record<string, unknown>).supports_modes)
        ? ((data as Record<string, unknown>).supports_modes as string[])
        : ["dry"],
    wetUpchargeCents:
      typeof (data as Record<string, unknown>).wet_upcharge_cents === "number"
        ? ((data as Record<string, unknown>).wet_upcharge_cents as number)
        : null,
    basePriceCents:
      typeof data.base_price === "number" ? Math.round(data.base_price * 100) : 0,
    // Phase 2e.6 — capability-aware PDP rendering. capability_slugs
    // tells the page which capabilities to surface; the cents/int
    // fields back the rendering when each is active.
    capabilitySlugs: Array.isArray(
      (data as Record<string, unknown>).capability_slugs,
    )
      ? ((data as Record<string, unknown>).capability_slugs as string[])
      : [],
    hourlyRateCents:
      typeof (data as Record<string, unknown>).hourly_rate_cents === "number"
        ? ((data as Record<string, unknown>).hourly_rate_cents as number)
        : null,
    minimumHours:
      typeof (data as Record<string, unknown>).minimum_hours === "number"
        ? ((data as Record<string, unknown>).minimum_hours as number)
        : null,
    // Phase 2e.13b — per-unit pricing fields surfaced to the PDP.
    // The units selector is gated on pricing.per-unit being in
    // capability_slugs, so the absent-values case for verticals that
    // don't use per-unit billing renders nothing on the storefront.
    unitPriceCents:
      typeof (data as Record<string, unknown>).unit_price_cents === "number"
        ? ((data as Record<string, unknown>).unit_price_cents as number)
        : null,
    unitLabel:
      typeof (data as Record<string, unknown>).unit_label === "string"
        ? ((data as Record<string, unknown>).unit_label as string)
        : null,
    minimumOrderQuantity:
      typeof (data as Record<string, unknown>).minimum_order_quantity === "number"
        ? ((data as Record<string, unknown>).minimum_order_quantity as number)
        : null,
    // Phase 1c — capacity calculator pair. Both surfaced unconditionally
    // so the PDP gate can use them; the widget only renders when the
    // capability slug is also present.
    capacityMetric: (() => {
      const m = (data as Record<string, unknown>).capacity_metric;
      return m === "guests" || m === "sq_ft" || m === "dancers" || m === "servings"
        ? m
        : null;
    })(),
    capacityValue:
      typeof (data as Record<string, unknown>).capacity_value === "number"
        ? ((data as Record<string, unknown>).capacity_value as number)
        : null,
    // Phase 2e.8 — structured specs surfaced on the PDP as a
    // definition list. Already sorted by display_order so the
    // operator's ordering is preserved.
    specs: (() => {
      const rows = (data as Record<string, unknown>).product_specs;
      if (!Array.isArray(rows)) return [];
      return [...rows]
        .map((r) => r as {
          id: string;
          spec_key: string;
          spec_label: string;
          spec_value: string;
          display_order: number | null;
        })
        .sort(
          (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
        )
        .map((r) => ({
          id: r.id,
          specKey: r.spec_key,
          specLabel: r.spec_label,
          specValue: r.spec_value,
          displayOrder: r.display_order ?? 0,
        }));
    })(),
    // Phase 2e.9 — variant gallery. One row per visual option
    // (backdrop / color / surface). Sorted by display_order;
    // is_default kept as a flag so the picker can highlight it on
    // initial render.
    variants: (() => {
      const rows = (data as Record<string, unknown>).product_variants;
      if (!Array.isArray(rows)) return [];
      return [...rows]
        .map((r) => r as {
          id: string;
          variant_label: string;
          thumbnail_url: string | null;
          preview_image_url: string | null;
          price_delta_cents: number;
          is_default: boolean;
          display_order: number | null;
        })
        .sort(
          (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
        )
        .map((r) => ({
          id: r.id,
          label: r.variant_label,
          thumbnailUrl: r.thumbnail_url,
          previewImageUrl: r.preview_image_url,
          priceDeltaCents: r.price_delta_cents,
          isDefault: !!r.is_default,
          displayOrder: r.display_order ?? 0,
        }));
    })(),
    // Phase 2e.10 — composition.add-ons. Each join row carries the
    // storefront presentation rules; the nested addon product row
    // provides the customer-visible name + base price. We bill the
    // add-on as a child order_items line at submit time, gated by
    // composition.add-ons being on the parent's capability_slugs.
    addOns: (() => {
      const rows = (data as Record<string, unknown>).product_addons;
      if (!Array.isArray(rows)) return [];
      return [...rows]
        .map((r) => r as {
          default_quantity: number;
          max_quantity: number | null;
          is_required: boolean;
          display_order: number | null;
          addon: {
            id: string;
            name: string | null;
            base_price: number | null;
          } | null;
        })
        .filter((r) => r.addon && typeof r.addon.id === "string")
        .sort(
          (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
        )
        .map((r) => ({
          addonProductId: r.addon!.id,
          name: r.addon!.name ?? "Add-on",
          basePriceCents:
            typeof r.addon!.base_price === "number"
              ? Math.round(r.addon!.base_price * 100)
              : 0,
          defaultQuantity: r.default_quantity ?? 0,
          maxQuantity: r.max_quantity,
          isRequired: !!r.is_required,
          displayOrder: r.display_order ?? 0,
        }));
    })(),
  };
});
