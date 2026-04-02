import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { resolveServiceAreaForAddress } from "@/lib/service-areas/lookup";

const DEPOSIT_RATE = 0.3;

export type CheckoutPricingData = {
  subtotal: number;
  deliveryFee: number | null;
  total: number | null;
  deposit: number | null;
};

export async function getCheckoutPricing(
  productSlug?: string,
  zip?: string
): Promise<CheckoutPricingData | null> {
  if (!productSlug) return null;

  if (!hasSupabaseEnv()) {
    // Fallback pricing for demo mode
    const demoSubtotal = 225;
    return {
      subtotal: demoSubtotal,
      deliveryFee: null,
      total: null,
      deposit: null,
    };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const { data: product } = await supabase
    .from("products")
    .select("base_price")
    .eq("slug", productSlug)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!product || typeof product.base_price !== "number") return null;

  const subtotal = Number(product.base_price);

  if (!zip) {
    return { subtotal, deliveryFee: null, total: null, deposit: null };
  }

  const serviceArea = await resolveServiceAreaForAddress({
    organizationId: orgId,
    postalCode: zip,
  });

  if (!serviceArea) {
    return { subtotal, deliveryFee: null, total: null, deposit: null };
  }

  const deliveryFee = serviceArea.deliveryFee;
  const total = Number((subtotal + deliveryFee).toFixed(2));
  const deposit = Number((total * DEPOSIT_RATE).toFixed(2));

  return { subtotal, deliveryFee, total, deposit };
}
