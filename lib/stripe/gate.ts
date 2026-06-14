"use server";

import { getSubscriptionInfo, type SubscriptionInfo } from "./subscription";
import { PLAN_TIERS, SMS_PLAN_TIERS, type PlanTier } from "./config";

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
  feature:
    | "stripe_payments"
    | "ai_copilot"
    | "csv_export"
    | "quickbooks_export"
    | "priority_support"
    | "sms"
    | "storefront_builder"
): Promise<GateResult> {
  const sub = await getSubscriptionInfo();

  // QuickBooks export sits at the Pro tier because the positioning is
  // "Pro includes the QuickBooks sync Goodshuffle charges $39/mo for as
  // an add-on" — see COMPETITIVE_POSITIONING_MASTER_PLAN.md. The general
  // csv_export gate stays at Growth so we don't cannibalize the Growth
  // upsell for bulk data dumps.
  const featurePlanRequirements: Record<string, PlanTier[]> = {
    stripe_payments: ["pro", "growth"],
    ai_copilot: ["pro", "growth"],
    csv_export: ["growth"],
    quickbooks_export: ["pro", "growth"],
    priority_support: ["growth"],
    // SMS/WhatsApp carries per-tenant Twilio + carrier cost → paid tiers.
    sms: SMS_PLAN_TIERS,
    // Editorial storefront builder (full theme tokens) is a Pro+ capability per
    // the spec's tiering (§5/§9): content + brand color/font = entry; full theme
    // tokens = Pro. Enforced on the builder page AND in the persist actions.
    storefront_builder: ["pro", "growth"],
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
