import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext, getPublicOrgId } from "@/lib/auth/org-context";
import type { PricingRule } from "@/lib/pricing/types";

const fallbackRules: PricingRule[] = [
  {
    id: "demo-weekend",
    name: "Weekend Surcharge",
    type: "weekend",
    adjustment: 15,
    conditions: { daysOfWeek: [0, 6] },
    isActive: true,
    priority: 10,
  },
  {
    id: "demo-early-bird",
    name: "Early Bird Discount",
    type: "early_bird",
    adjustment: -10,
    conditions: { daysBeforeEvent: { min: 14 } },
    isActive: true,
    priority: 5,
  },
];

export async function getPricingRules(): Promise<PricingRule[]> {
  if (!hasSupabaseEnv()) {
    return fallbackRules;
  }

  // Support both authenticated dashboard context and public storefront (unauthenticated tenant)
  const ctx = await getOrgContext();
  const organizationId = ctx?.organizationId ?? (await getPublicOrgId());
  if (!organizationId) {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", organizationId)
    .maybeSingle();

  const settings = (org?.settings as Record<string, unknown>) ?? {};
  const rules = settings.pricing_rules as PricingRule[] | undefined;

  return rules && Array.isArray(rules) ? rules : [];
}
