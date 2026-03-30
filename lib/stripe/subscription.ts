"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { PLAN_TIERS, type PlanTier } from "./config";

export type SubscriptionInfo = {
  plan: PlanTier | null;
  status: string;
  currentPeriodEnd: string | null;
  hasActiveSubscription: boolean;
  limits: {
    products: number;
    ordersPerMonth: number;
    teamMembers: number;
  };
};

const FREE_LIMITS = {
  products: 5,
  ordersPerMonth: 10,
  teamMembers: 1,
};

export async function getSubscriptionInfo(): Promise<SubscriptionInfo> {
  if (!hasSupabaseEnv()) {
    return {
      plan: "pro",
      status: "active",
      currentPeriodEnd: null,
      hasActiveSubscription: true,
      limits: PLAN_TIERS.pro.limits,
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return {
      plan: null,
      status: "none",
      currentPeriodEnd: null,
      hasActiveSubscription: false,
      limits: FREE_LIMITS,
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "subscription_status, subscription_plan, subscription_current_period_end"
    )
    .eq("id", ctx.organizationId)
    .maybeSingle();

  if (!org || !org.subscription_plan) {
    return {
      plan: null,
      status: org?.subscription_status ?? "none",
      currentPeriodEnd: null,
      hasActiveSubscription: false,
      limits: FREE_LIMITS,
    };
  }

  const plan = org.subscription_plan as PlanTier;
  const isActive = ["active", "trialing"].includes(org.subscription_status);

  return {
    plan,
    status: org.subscription_status,
    currentPeriodEnd: org.subscription_current_period_end,
    hasActiveSubscription: isActive,
    limits: isActive && PLAN_TIERS[plan]
      ? PLAN_TIERS[plan].limits
      : FREE_LIMITS,
  };
}
