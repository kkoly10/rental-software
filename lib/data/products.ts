import { mockProducts } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { paginateItems, type PaginatedResult, normalizeQuery } from "@/lib/listing/pagination";
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
    const filtered = mockProducts.filter((product) =>
      matchesProductQuery(product, query)
    );
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, base_price, is_active, deleted_at, categories(name, deleted_at)")
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(500);

  if (error || !data || data.length === 0) {
    const filtered = mockProducts.filter((product) =>
      matchesProductQuery(product, query)
    );
    return paginateItems(filtered, {
      page: options?.page,
      pageSize: options?.pageSize ?? 20,
      query,
    });
  }

  const mapped: ProductSummary[] = data.map((product) => {
    const category = (product as Record<string, unknown>).categories as
      | { name?: string | null; deleted_at?: string | null }
      | null;

    return {
      id: product.id,
      name: product.name ?? "Unnamed",
      category:
        category && !category.deleted_at ? category.name ?? "Inflatable" : "Inflatable",
      price:
        typeof product.base_price === "number"
          ? `$${product.base_price}/day`
          : "$0/day",
      status: product.is_active ? "Active" : "Hidden",
      tone: (product.is_active ? "success" : "default") as ProductSummary["tone"],
    };
  });

  const filtered = mapped.filter((product) =>
    matchesProductQuery(product, query)
  );

  return paginateItems(filtered, {
    page: options?.page,
    pageSize: options?.pageSize ?? 20,
    query,
  });
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
    category: category && !category.deleted_at ? category.name : "Inflatable",
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
  };
}

export async function getCategories() {
  if (!hasSupabaseEnv()) {
    return [
      { id: "cat_1", name: "Bounce House", slug: "bounce-houses" },
      { id: "cat_2", name: "Water Slide", slug: "water-slides" },
      { id: "cat_3", name: "Combo Unit", slug: "combos" },
      { id: "cat_4", name: "Obstacle Course", slug: "obstacle-courses" },
      { id: "cat_5", name: "Add-on", slug: "add-ons" },
    ];
  }

  const ctx = await getOrgContext();

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("categories")
    .select("id, name, slug")
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (ctx) {
    query = query.eq("organization_id", ctx.organizationId);
  }

  const { data, error } = await query;

  if (error || !data) {
    return [];
  }

  return data.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
}