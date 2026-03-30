"use server";

import { getSubscriptionInfo, type SubscriptionInfo } from "./subscription";
import { PLAN_TIERS, type PlanTier } from "./config";

export type GateResult = {
  allowed: boolean;
  reason?: string;
  currentUsage?: number;
  limit?: number;
};

/**
 * Check whether the current organization is within their plan limits
 * for a given resource. Returns { allowed: true } if within limits.
 */
export async function checkPlanLimit(
  resource: "products" | "ordersPerMonth" | "teamMembers",
  currentCount: number
): Promise<GateResult> {
  const sub = await getSubscriptionInfo();

  const limit = sub.limits[resource];

  if (limit === Infinity || currentCount < limit) {
    return { allowed: true, currentUsage: currentCount, limit };
  }

  const planName = sub.plan ? PLAN_TIERS[sub.plan].name : "Free";

  return {
    allowed: false,
    reason: `You've reached the ${resource.replace(/([A-Z])/g, " $1").toLowerCase()} limit on the ${planName} plan. Upgrade to add more.`,
    currentUsage: currentCount,
    limit,
  };
}

/**
 * Check if a feature is available on the current plan.
 */
export async function checkFeatureAccess(
  feature: "stripe_payments" | "ai_copilot" | "csv_export" | "priority_support"
): Promise<GateResult> {
  const sub = await getSubscriptionInfo();

  const featurePlanRequirements: Record<string, PlanTier[]> = {
    stripe_payments: ["pro", "growth"],
    ai_copilot: ["pro", "growth"],
    csv_export: ["growth"],
    priority_support: ["growth"],
  };

  const requiredPlans = featurePlanRequirements[feature];
  if (!requiredPlans) {
    return { allowed: true };
  }

  if (sub.plan && requiredPlans.includes(sub.plan) && sub.hasActiveSubscription) {
    return { allowed: true };
  }

  const lowestPlan = requiredPlans[0];
  const planName = lowestPlan ? PLAN_TIERS[lowestPlan].name : "Pro";

  return {
    allowed: false,
    reason: `This feature requires the ${planName} plan or higher.`,
  };
}
