"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { hashPortalAccessToken, isPortalTokenExpired } from "@/lib/portal/access-token";
import { getOrderFinancials } from "@/lib/payments/financials";
import { getStripe, hasStripeEnv } from "@/lib/stripe/config";
import { getSiteUrl } from "@/lib/site-url";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export type PayBalanceState = { ok: boolean; message: string; stripeUrl?: string };

export async function createBalancePaymentSession(
  _prev: PayBalanceState,
  formData: FormData
): Promise<PayBalanceState> {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Demo mode: payment not available." };
  }
  if (!hasStripeEnv()) {
    return { ok: false, message: "Online payments are not configured for this account." };
  }

  const token = String(formData.get("portal_token") ?? "").trim();
  if (!token) return { ok: false, message: "Invalid portal link." };

  try {
    const clientKey = await getActionClientKey();
    const [clientLimit, tokenLimit] = await Promise.all([
      enforceRateLimit({ scope: "portal:pay-balance:client", actor: clientKey, limit: 10, windowSeconds: 600, strict: true }),
      enforceRateLimit({ scope: "portal:pay-balance:token", actor: hashPortalAccessToken(token), limit: 5, windowSeconds: 600, strict: true }),
    ]);
    if (!clientLimit.allowed || !tokenLimit.allowed) {
      return { ok: false, message: "Too many attempts. Please wait a moment." };
    }
  } catch {
    return { ok: false, message: "Unable to process right now." };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) return { ok: false, message: "Service unavailable." };

  // Verify the org's plan allows Stripe payments
  const { checkFeatureAccess } = await import("@/lib/stripe/gate");
  const stripeGate = await checkFeatureAccess("stripe_payments");
  if (!stripeGate.allowed) {
    return { ok: false, message: "Online payments are not available. Please contact us to pay your balance." };
  }

  const supabase = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : await createSupabaseServerClient();
  const tokenHash = hashPortalAccessToken(token);

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, total_amount, portal_access_token_created_at, customers!inner(email, first_name, last_name)")
    .eq("organization_id", orgId)
    .eq("portal_access_token_hash", tokenHash)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) return { ok: false, message: "Order not found." };
  if (isPortalTokenExpired(order.portal_access_token_created_at)) {
    return { ok: false, message: "This portal link has expired. Contact us for a new one." };
  }

  const financials = await getOrderFinancials(order.id, orgId);
  const balance = financials?.remainingBalance ?? 0;

  if (balance <= 0) {
    return { ok: false, message: "No balance is due on this order." };
  }

  const customer = order.customers as unknown as {
    email: string | null;
    first_name: string | null;
    last_name: string | null;
  };

  const siteUrl = await getSiteUrl();
  const stripe = getStripe();

  // Resolve org currency so non-USD operators charge balances in their
  // own currency. Helper applies zero-decimal handling for JPY/KRW/etc.
  const { data: orgCurrencyRow } = await supabase
    .from("organizations")
    .select("default_currency")
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  const { normalizeCurrency, toStripeMinorUnits } = await import("@/lib/money/currency");
  const orgCurrency = normalizeCurrency(orgCurrencyRow?.default_currency);

  // #391 If Stripe is misconfigured or unreachable the create() call throws,
  // which would become a Next 16 500 page for the customer mid-checkout.
  // Catch and return a stable ok:false instead.
  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: orgCurrency,
            product_data: {
              name: `Balance — Order ${order.order_number}`,
              description: "Remaining rental balance",
            },
            unit_amount: toStripeMinorUnits(balance, orgCurrency),
          },
          quantity: 1,
        },
      ],
      customer_email: customer.email ?? undefined,
      success_url: `${siteUrl}/order-status?token=${encodeURIComponent(token)}&paid=1`,
      cancel_url: `${siteUrl}/order-status?token=${encodeURIComponent(token)}`,
      metadata: {
        organization_id: orgId,
        order_id: order.id,
        order_number: order.order_number,
        payment_type: "balance",
      },
    });
  } catch (err) {
    console.error("[pay-balance] Stripe session create failed:", err instanceof Error ? err.message : err);
    return { ok: false, message: "Payments are temporarily unavailable. Please try again in a moment." };
  }

  if (!session.url) {
    return { ok: false, message: "Could not create payment session. Please try again." };
  }

  return { ok: true, message: "Redirecting to payment…", stripeUrl: session.url };
}
