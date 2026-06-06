import { mockProducts } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getOrgFormatting } from "@/lib/i18n/org-formatting";
import { formatMoney } from "@/lib/i18n/format-helpers";
import { paginateItems, type PaginatedResult, normalizeQuery, normalizePage } from "@/lib/listing/pagination";
import type { ProductSummary } from "@/lib/types";

function matchesProductQuery(product: ProductSummary, query: string) {
  if (!query) return true;

  const haystack = [
    product.name,
    product.category,
    product.price,
    product.status,
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

export async function getProductsPage(options?: {
  page?: string | number | null;
  query?: string | null;
  pageSize?: number;
}): Promise<PaginatedResult<ProductSummary>> {
  const query = normalizeQuery(options?.query);

  if (!hasSupabaseEnv()) {
    const filtered = mockProducts.filter((product) =>
      matchesProductQuery(product, query)
    );
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return paginateItems([], { page: options?.page, pageSize: options?.pageSize ?? 20, query });
  }

  const { currency, locale } = await getOrgFormatting();
  const money = (n: number) => formatMoney(n, currency, locale);

  const supabase = await createSupabaseServerClient();
  const selectFields = "id, name, slug, base_price, is_active, deleted_at, categories(name, deleted_at), product_images(image_url, is_primary, sort_order)";
  const pageSize = options?.pageSize ?? 20;

  // No-query path: DB-side paginate + count so every product is reachable.
  if (!query) {
    const currentPage = normalizePage(options?.page);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize - 1;
    const { data, error, count } = await supabase
      .from("products")
      .select(selectFields, { count: "exact" })
      .eq("organization_id", ctx.organizationId)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .range(start, end);

    if (error) {
      console.error("[products] Query failed:", error.message);
      return paginateItems([], { page: options?.page, pageSize, query });
    }

    const mappedPage = (data ?? []).map((p) => mapProductRow(p, money));
    await enrichWithOpenMaintenance(supabase, ctx.organizationId, mappedPage);
    const totalItems = count ?? mappedPage.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    return {
      items: mappedPage,
      page: Math.min(currentPage, totalPages),
      pageSize,
      totalItems,
      totalPages,
      query: "",
    };
  }

  // Search path: pull a larger window and JS-filter (query spans category name
  // via embedded join).
  const SEARCH_WINDOW = 5000;
  const { data, error } = await supabase
    .from("products")
    .select(selectFields)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(SEARCH_WINDOW);

  if (error) {
    console.error("[products] Query failed:", error.message);
    return paginateItems([], { page: options?.page, pageSize, query });
  }

  // Surface truncation: past SEARCH_WINDOW products, JS-side search silently
  // can't see the tail. Log it so a large catalog's missing matches aren't a
  // mystery (mirrors the truncation logging in analytics.ts).
  if (data.length === SEARCH_WINDOW) {
    console.warn(
      `[products] search window capped at ${SEARCH_WINDOW} rows for org ${ctx.organizationId}; results beyond that are not searched.`
    );
  }

  const mapped: ProductSummary[] = data.map((p) => mapProductRow(p, money));
  const filtered = mapped.filter((product) => matchesProductQuery(product, query));
  await enrichWithOpenMaintenance(supabase, ctx.organizationId, filtered);

  return paginateItems(filtered, {
    page: options?.page,
    pageSize,
    query,
  });
}

type ProductImageRow = {
  image_url: string | null;
  is_primary: boolean | null;
  sort_order: number | null;
};

type ProductRow = {
  id: string;
  name: string | null;
  slug: string | null;
  base_price: number | string | null;
  is_active: boolean | null;
  deleted_at: string | null;
  product_images?: ProductImageRow[] | null;
};

// Patch 4 — primary image first, then lowest sort_order. Returns undefined
// when the product has no images (the catalog renders a tinted placeholder).
function pickPrimaryImage(images?: ProductImageRow[] | null): string | undefined {
  if (!images || images.length === 0) return undefined;
  const sorted = [...images].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return sorted[0].image_url ?? undefined;
}

/**
 * Post-fetch enrichment: mark each product as having open maintenance if
 * any of its assets has an open or in-progress maintenance_record. Run
 * as a single batched query keyed off the product_ids we just paged so
 * we don't N+1 the list. Decision 2.4 / follow-up #5: storefront stays
 * capacity-aware but the operator UI surfaces the signal.
 */
async function enrichWithOpenMaintenance(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  organizationId: string,
  items: ProductSummary[]
): Promise<void> {
  if (items.length === 0) return;
  const productIds = items.map((p) => p.id);
  const { data } = await supabase
    .from("maintenance_records")
    .select("assets!inner(product_id)")
    .eq("organization_id", organizationId)
    .in("status", ["open", "in_progress"])
    .in("assets.product_id", productIds);
  if (!data) return;
  const productsWithOpen = new Set<string>();
  for (const row of data) {
    const asset = (row as { assets?: { product_id?: string } | null }).assets;
    if (asset?.product_id) productsWithOpen.add(asset.product_id);
  }
  for (const p of items) {
    if (productsWithOpen.has(p.id)) p.hasOpenMaintenance = true;
  }
}

function mapProductRow(product: ProductRow, money: (n: number) => string): ProductSummary {
  const category = (product as Record<string, unknown>).categories as
    | { name?: string | null; deleted_at?: string | null }
    | null;
  const hasValidPrice =
    typeof product.base_price === "number" && product.base_price > 0;
  return {
    id: product.id,
    name: product.name ?? "Unnamed",
    category:
      category && !category.deleted_at ? category.name ?? "Rental" : "Rental",
    price: hasValidPrice ? `${money(Number(product.base_price))}/day` : "—",
    status: product.is_active ? "Active" : "Hidden",
    tone: (product.is_active ? "success" : "default") as ProductSummary["tone"],
    // Only flag active products — a draft without a price is fine until
    // it's published.
    missingPrice: Boolean(product.is_active) && !hasValidPrice,
    imageUrl: pickPrimaryImage(product.product_images),
  };
}

export async function getProducts(): Promise<ProductSummary[]> {
  const result = await getProductsPage();
  return result.items;
}

export async function getProductById(productId: string) {
  if (!hasSupabaseEnv()) {
    const mock = mockProducts.find((p) => p.id === productId);
    return mock
      ? {
          id: mock.id,
          name: mock.name,
          slug: mock.id.replace("prod_", "").replace(/_/g, "-"),
          category: mock.category,
          categoryId: "",
          shortDescription: "",
          description: "",
          basePrice: parseFloat(mock.price.replace(/[^0-9.]/g, "")) || 0,
          securityDeposit: 50,
          isActive: mock.status === "Active",
          visibility: "public" as const,
          requiresDelivery: true,
          pricingModel: "flat_day" as const,
        }
      : null;
  }

  const ctx = await getOrgContext();
  if (!ctx) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(id, name, deleted_at)")
    .eq("id", productId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) return null;

  const category = (data as Record<string, unknown>).categories as
    | { id: string; name: string; deleted_at?: string | null }
    | null;

  return {
    id: data.id,
    name: data.name ?? "",
    slug: data.slug ?? "",
    category: category && !category.deleted_at ? category.name : "Rental",
    categoryId: category && !category.deleted_at ? category.id : "",
    shortDescription: data.short_description ?? "",
    description: data.description ?? "",
    basePrice: typeof data.base_price === "number" ? data.base_price : 0,
    securityDeposit:
      typeof data.security_deposit_amount === "number"
        ? data.security_deposit_amount
        : 0,
    isActive: data.is_active ?? true,
    visibility: data.visibility ?? "public",
    requiresDelivery: data.requires_delivery ?? true,
    pricingModel: data.pricing_model ?? "flat_day",
    // Sprint 6.0 — inflatable-vertical optional fields. Defaults
    // mirror the migration so a row written before this column existed
    // (effectively impossible at runtime since the migration was
    // applied first, but defensive) reads as the simple default.
    supportsModes:
      Array.isArray(data.supports_modes) && data.supports_modes.length > 0
        ? (data.supports_modes as string[])
        : ["dry"],
    wetUpchargeCents:
      typeof data.wet_upcharge_cents === "number"
        ? data.wet_upcharge_cents
        : null,
    anchoringMethods: Array.isArray(data.anchoring_methods)
      ? (data.anchoring_methods as string[])
      : [],
    requiredAnchorCount:
      typeof data.required_anchor_count === "number"
        ? data.required_anchor_count
        : null,
    // Phase 2e.1 — capability assignment. Defaults to empty when the
    // column hasn't been backfilled or the product pre-dates the
    // migration.
    capabilitySlugs: Array.isArray(data.capability_slugs)
      ? (data.capability_slugs as string[])
      : [],
    // Phase 2e.3 — per-hour pricing fields. Null = the operator
    // hasn't entered a value (or the capability isn't active).
    hourlyRateCents:
      typeof data.hourly_rate_cents === "number"
        ? data.hourly_rate_cents
        : null,
    minimumHours:
      typeof data.minimum_hours === "number" ? data.minimum_hours : null,
    idleHourRateCents:
      typeof data.idle_hour_rate_cents === "number"
        ? data.idle_hour_rate_cents
        : null,
    // Phase 2e.4 — per-unit pricing fields.
    unitPriceCents:
      typeof data.unit_price_cents === "number" ? data.unit_price_cents : null,
    unitLabel: typeof data.unit_label === "string" ? data.unit_label : null,
  };
}

export async function getCategories() {
  if (!hasSupabaseEnv()) {
    return [
      { id: "cat_1", name: "Bounce House", slug: "bounce-houses", vertical: "inflatable" },
      { id: "cat_2", name: "Water Slide", slug: "water-slides", vertical: "inflatable" },
      { id: "cat_3", name: "Combo Unit", slug: "combos", vertical: "inflatable" },
      { id: "cat_4", name: "Obstacle Course", slug: "obstacle-courses", vertical: "inflatable" },
      { id: "cat_5", name: "Add-on", slug: "add-ons", vertical: "inflatable" },
    ];
  }

  const ctx = await getOrgContext();
  if (!ctx) return [];

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    // Sprint 6.0 — include vertical so the product form can conditionally
    // render the inflatable-setup accordion based on the selected
    // category's vertical without an extra round-trip.
    .select("id, name, slug, vertical")
    .eq("organization_id", ctx.organizationId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    vertical: c.vertical,
  }));
}