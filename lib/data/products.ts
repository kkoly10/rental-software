import { mockProducts } from "@/lib/mock-data";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getProducts() {
  if (!hasSupabaseEnv()) {
    return mockProducts;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, base_price, is_active")
    .order("name", { ascending: true });

  if (error || !data) {
    return mockProducts;
  }

  return data.map((product) => ({
    id: product.id,
    name: product.name ?? "Unnamed Product",
    category: "Inflatable",
    price:
      typeof product.base_price === "number"
        ? `$${product.base_price}/day`
        : "$0/day",
    status: product.is_active ? "Active" : "Hidden",
    tone: product.is_active ? "success" : "default",
    slug: product.slug ?? "product",
  }));
}
