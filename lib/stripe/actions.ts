"use server";

import { redirect } from "next/navigation";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getStripe, hasStripeEnv, PLAN_TIERS, type PlanTier } from "./config";

export type SubscriptionActionState = {
  ok: boolean;
  message: string;
  url?: string;
};

/**
 * Creates a Stripe Checkout session for a new subscription.
 * Redirects the user to the Stripe-hosted checkout page.
 */
export async function createCheckoutSession(
  _prevState: SubscriptionActionState,
  formData: FormData
): Promise<SubscriptionActionState> {
  const tier = formData.get("tier") as PlanTier | null;
  const interval = formData.get("interval") as "monthly" | "yearly" | null;

  if (!tier || !PLAN_TIERS[tier]) {
    return { ok: false, message: "Invalid plan selected." };
  }

  if (!interval || !["monthly", "yearly"].includes(interval)) {
    return { ok: false, message: "Invalid billing interval." };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: checkout session would be created." };
  }

  if (!hasStripeEnv()) {
    return { ok: false, message: "Payment processing is not configured yet." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "You must be signed in to subscribe." };
  }

  try {
    const clientKey = await getActionClientKey();
    const [userLimit, clientLimit] = await Promise.all([
      enforceRateLimit({
        scope: "subscription:checkout:user",
        actor: ctx.userId,
        limit: 10,
        windowSeconds: 300,
      }),
      enforceRateLimit({
        scope: "subscription:checkout:client",
        actor: clientKey,
        limit: 15,
        windowSeconds: 300,
      }),
    ]);

    if (!userLimit.allowed || !clientLimit.allowed) {
      return { ok: false, message: "Too many requests. Please wait and try again." };
    }
  } catch {
    return { ok: false, message: "Unable to process request right now." };
  }

  const supabase = await createSupabaseServerClient();

  // Get org details for Stripe metadata
  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, stripe_customer_id")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  if (!org) {
    return { ok: false, message: "Organization not found." };
  }

  // Get user email for Stripe
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { ok: false, message: "User email not available." };
  }

  const plan = PLAN_TIERS[tier];
  const priceId =
    interval === "yearly" ? plan.stripePriceIdYearly : plan.stripePriceIdMonthly;

  if (!priceId) {
    return { ok: false, message: "This plan is not available yet. Please contact support." };
  }

  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    // Create or reuse Stripe customer
    let customerId = org.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: org.name,
        metadata: {
          organization_id: ctx.organizationId,
          user_id: ctx.userId,
        },
      });
      customerId = customer.id;

      await supabase
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", ctx.organizationId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/dashboard/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/dashboard/settings/billing`,
      subscription_data: {
        metadata: {
          organization_id: ctx.organizationId,
          plan_tier: tier,
        },
      },
      metadata: {
        organization_id: ctx.organizationId,
        plan_tier: tier,
      },
      allow_promotion_codes: true,
    });

    if (session.url) {
      redirect(session.url);
    }

    return { ok: false, message: "Could not create checkout session." };
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error; // Let Next.js handle the redirect
    }
    console.error("Stripe checkout error:", error);
    return { ok: false, message: "Failed to start checkout. Please try again." };
  }
}

/**
 * Creates a Stripe Billing Portal session so the operator can manage
 * their subscription (upgrade, downgrade, cancel, update payment method).
 */
export async function createBillingPortalSession(): Promise<SubscriptionActionState> {
  if (!hasSupabaseEnv() || !hasStripeEnv()) {
    return { ok: false, message: "Billing is not configured." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "You must be signed in." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_customer_id")
    .eq("id", ctx.organizationId)
    .maybeSingle();

  if (!org?.stripe_customer_id) {
    return { ok: false, message: "No billing account found. Please subscribe first." };
  }

  const stripe = getStripe();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: `${siteUrl}/dashboard/settings/billing`,
    });

    if (session.url) {
      redirect(session.url);
    }

    return { ok: false, message: "Could not create portal session." };
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error;
    }
    console.error("Stripe portal error:", error);
    return { ok: false, message: "Failed to open billing portal." };
  }
}
