import { mockProducts } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProductSummary } from "@/lib/types";

export async function getProducts(): Promise<ProductSummary[]> {
  if (!hasSupabaseEnv()) {
    return mockProducts;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, base_price, is_active, categories(name)")
    .order("name", { ascending: true });

  if (error || !data || data.length === 0) {
    return mockProducts;
  }

  return data.map((product) => {
    const category = (product as Record<string, unknown>).categories as { name: string } | null;
    return {
      id: product.id,
      name: product.name ?? "Unnamed",
      category: category?.name ?? "Inflatable",
      price: typeof product.base_price === "number" ? `$${product.base_price}/day` : "$0/day",
      status: product.is_active ? "Active" : "Hidden",
      tone: (product.is_active ? "success" : "default") as ProductSummary["tone"],
    };
  });
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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, categories(id, name)")
    .eq("id", productId)
    .maybeSingle();

  if (error || !data) return null;

  const category = (data as Record<string, unknown>).categories as { id: string; name: string } | null;

  return {
    id: data.id,
    name: data.name ?? "",
    slug: data.slug ?? "",
    category: category?.name ?? "Inflatable",
    categoryId: category?.id ?? "",
    shortDescription: data.short_description ?? "",
    description: data.description ?? "",
    basePrice: typeof data.base_price === "number" ? data.base_price : 0,
    securityDeposit: typeof data.security_deposit_amount === "number" ? data.security_deposit_amount : 0,
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

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
}
