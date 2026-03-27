import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";

export type OrderFormProductOption = {
  id: string;
  name: string;
  basePrice: number;
};

export type OrderFormServiceAreaOption = {
  id: string;
  label: string;
  deliveryFee: number;
  minimumOrderAmount: number;
};

export async function getOrderFormOptions() {
  if (!hasSupabaseEnv()) {
    return {
      products: [
        { id: "prod_demo_1", name: "Castle Bouncer", basePrice: 165 },
        { id: "prod_demo_2", name: "Mega Splash Water Slide", basePrice: 279 },
      ] satisfies OrderFormProductOption[],
      serviceAreas: [
        {
          id: "area_demo_1",
          label: "Primary local coverage",
          deliveryFee: 20,
          minimumOrderAmount: 125,
        },
      ] satisfies OrderFormServiceAreaOption[],
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return {
      products: [] as OrderFormProductOption[],
      serviceAreas: [] as OrderFormServiceAreaOption[],
    };
  }

  const supabase = await createSupabaseServerClient();
  const [{ data: products }, { data: serviceAreas }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, base_price")
      .eq("organization_id", ctx.organizationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("service_areas")
      .select("id, label, delivery_fee, minimum_order_amount")
      .eq("organization_id", ctx.organizationId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("label", { ascending: true }),
  ]);

  return {
    products:
      products?.map((product) => ({
        id: product.id,
        name: product.name ?? "Product",
        basePrice: Number(product.base_price ?? 0),
      })) ?? [],
    serviceAreas:
      serviceAreas?.map((area) => ({
        id: area.id,
        label: area.label ?? "Service Area",
        deliveryFee: Number(area.delivery_fee ?? 0),
        minimumOrderAmount: Number(area.minimum_order_amount ?? 0),
      })) ?? [],
  };
}
