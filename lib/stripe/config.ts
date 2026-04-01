import Stripe from "stripe";
import { getOptionalEnv } from "@/lib/env";

let stripeInstance: Stripe | null = null;

export function hasStripeEnv() {
  return Boolean(getOptionalEnv("STRIPE_SECRET_KEY"));
}

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = getOptionalEnv("STRIPE_SECRET_KEY");
    if (!key) {
      throw new Error("Missing STRIPE_SECRET_KEY environment variable");
    }
    stripeInstance = new Stripe(key, { apiVersion: "2026-03-25.dahlia" });
  }
  return stripeInstance;
}

/**
 * Subscription plan tiers for Korent.
 *
 * Each tier defines limits that are enforced at the application layer.
 * The `stripePriceId` fields must be populated after creating products
 * in the Stripe dashboard or via the seed script.
 */
export const PLAN_TIERS = {
  starter: {
    name: "Starter",
    monthlyPrice: 4900, // cents
    yearlyPrice: 46800, // cents ($39/mo billed annually)
    limits: {
      products: 25,
      ordersPerMonth: 50,
      teamMembers: 1,
    },
    features: [
      "Up to 25 products",
      "Up to 50 orders / month",
      "Online storefront",
      "Delivery board",
      "Contracts & waivers",
      "Manual payments",
    ],
    stripePriceIdMonthly: getOptionalEnv("STRIPE_STARTER_MONTHLY_PRICE_ID") ?? "",
    stripePriceIdYearly: getOptionalEnv("STRIPE_STARTER_YEARLY_PRICE_ID") ?? "",
  },
  pro: {
    name: "Pro",
    monthlyPrice: 9900,
    yearlyPrice: 94800, // $79/mo billed annually
    limits: {
      products: 100,
      ordersPerMonth: 200,
      teamMembers: 5,
    },
    features: [
      "Up to 100 products",
      "Up to 200 orders / month",
      "Up to 5 team members",
      "Online storefront",
      "Stripe online payments",
      "Full delivery board",
      "AI Copilot assistant",
      "Contracts & waivers",
    ],
    popular: true,
    stripePriceIdMonthly: getOptionalEnv("STRIPE_PRO_MONTHLY_PRICE_ID") ?? "",
    stripePriceIdYearly: getOptionalEnv("STRIPE_PRO_YEARLY_PRICE_ID") ?? "",
  },
  growth: {
    name: "Growth",
    monthlyPrice: 19900,
    yearlyPrice: 190800, // $159/mo billed annually
    limits: {
      products: Infinity,
      ordersPerMonth: Infinity,
      teamMembers: 15,
    },
    features: [
      "Unlimited products",
      "Unlimited orders",
      "Up to 15 team members",
      "Online storefront",
      "Stripe + auto-invoicing",
      "Full delivery board",
      "AI Copilot assistant",
      "Contracts & waivers",
      "Reports & CSV export",
      "Priority support",
    ],
    stripePriceIdMonthly: getOptionalEnv("STRIPE_GROWTH_MONTHLY_PRICE_ID") ?? "",
    stripePriceIdYearly: getOptionalEnv("STRIPE_GROWTH_YEARLY_PRICE_ID") ?? "",
  },
} as const;

export type PlanTier = keyof typeof PLAN_TIERS;

export function getPlanByPriceId(priceId: string): PlanTier | null {
  for (const [tier, plan] of Object.entries(PLAN_TIERS)) {
    if (
      plan.stripePriceIdMonthly === priceId ||
      plan.stripePriceIdYearly === priceId
    ) {
      return tier as PlanTier;
    }
  }
  return null;
}

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`;
}
