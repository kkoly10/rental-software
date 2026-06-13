"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { PLAN_TIERS, planAllowsSms, type PlanTier } from "./config";

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
    .is("deleted_at", null)
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
  // past_due retains full plan access until actually canceled/unpaid —
  // locking out users on the first missed payment creates unnecessary churn.
  const isActive = ["active", "trialing", "past_due"].includes(org.subscription_status);

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

/**
 * Whether an org's plan allows outbound SMS/WhatsApp — resolved BY ORG ID,
 * not by auth context, so it works from cron-dispatched notifications
 * where there is no logged-in user. Demo mode (no Supabase) returns true
 * to match getSubscriptionInfo's demo behavior.
 */
export async function orgPlanAllowsSms(organizationId: string): Promise<boolean> {
  if (!hasSupabaseEnv()) return true;
  if (!organizationId) return false;

  // Use the service-role client: this runs from cron/dispatch where there's
  // no authenticated session, and anon SELECT on organizations excludes
  // subscription_status/subscription_plan (migration 20260601_041000) — so
  // the anon client would read nothing and falsely suppress SMS for every
  // paid org. Service role bypasses RLS for this trusted by-org-id read.
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createSupabaseAdminClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("subscription_status, subscription_plan")
    .eq("id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!org?.subscription_plan) return false;
  const isActive = ["active", "trialing", "past_due"].includes(
    org.subscription_status as string
  );
  return isActive && planAllowsSms(org.subscription_plan as PlanTier);
}
