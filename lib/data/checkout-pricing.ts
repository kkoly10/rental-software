import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { resolveServiceAreaForAddress } from "@/lib/service-areas/lookup";
import { getBookingPolicies } from "@/lib/data/booking-policies";
import { calculatePrice } from "@/lib/pricing/engine";
import type { PricingRule } from "@/lib/pricing/types";

export type CheckoutPricingData = {
  basePrice: number;
  adjustments: { ruleName: string; amount: number; percentage: number }[];
  subtotal: number;
  deliveryFee: number | null;
  total: number | null;
  deposit: number | null;
};

export async function getCheckoutPricing(
  productSlug?: string,
  zip?: string,
  date?: string
): Promise<CheckoutPricingData | null> {
  if (!productSlug) return null;

  if (!hasSupabaseEnv()) {
    const demoSubtotal = 225;
    return {
      basePrice: demoSubtotal,
      adjustments: [],
      subtotal: demoSubtotal,
      deliveryFee: null,
      total: null,
      deposit: null,
    };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();

  const [{ data: product }, { data: org }] = await Promise.all([
    supabase
      .from("products")
      .select("base_price")
      .eq("slug", productSlug)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (!product || typeof product.base_price !== "number") return null;

  const basePrice = Number(product.base_price);

  // Apply pricing rules when the customer has selected an event date
  let subtotal = basePrice;
  let adjustments: { ruleName: string; amount: number; percentage: number }[] = [];

  if (date) {
    const settings = (org?.settings as Record<string, unknown>) ?? {};
    const rules = (settings.pricing_rules as PricingRule[] | undefined) ?? [];
    if (rules.length > 0) {
      const calc = calculatePrice(basePrice, rules, { eventDate: date });
      subtotal = calc.finalPrice;
      adjustments = calc.adjustments;
    }
  }

  if (!zip) {
    return { basePrice, adjustments, subtotal, deliveryFee: null, total: null, deposit: null };
  }

  const serviceArea = await resolveServiceAreaForAddress({
    organizationId: orgId,
    postalCode: zip,
  });

  if (!serviceArea) {
    return { basePrice, adjustments, subtotal, deliveryFee: null, total: null, deposit: null };
  }

  const deliveryFee = serviceArea.deliveryFee;
  const total = Number((subtotal + deliveryFee).toFixed(2));

  const policies = await getBookingPolicies();
  let deposit = Number((total * (policies.depositPercentage / 100)).toFixed(2));
  if (policies.depositMinimum !== null && deposit < policies.depositMinimum) {
    deposit = Math.min(policies.depositMinimum, total);
  }

  return { basePrice, adjustments, subtotal, deliveryFee, total, deposit };
}
