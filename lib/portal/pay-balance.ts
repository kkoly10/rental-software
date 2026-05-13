"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { hashPortalAccessToken, isPortalTokenExpired } from "@/lib/portal/access-token";
import { getOrderFinancials } from "@/lib/payments/financials";
import { getStripe, hasStripeEnv } from "@/lib/stripe/config";
import { getSiteUrl } from "@/lib/site-url";

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

  const orgId = await getPublicOrgId();
  if (!orgId) return { ok: false, message: "Service unavailable." };

  const supabase = await createSupabaseServerClient();
  const tokenHash = hashPortalAccessToken(token);

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, total_amount, portal_access_token_created_at, customers!inner(email, first_name, last_name)")
    .eq("organization_id", orgId)
    .eq("portal_access_token_hash", tokenHash)
    .maybeSingle();

  if (!order) return { ok: false, message: "Order not found." };
  if (isPortalTokenExpired(order.portal_access_token_created_at)) {
    return { ok: false, message: "This portal link has expired. Contact us for a new one." };
  }

  const financials = await getOrderFinancials(order.id);
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

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Balance — Order ${order.order_number}`,
            description: "Remaining rental balance",
          },
          unit_amount: Math.round(balance * 100),
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

  if (!session.url) {
    return { ok: false, message: "Could not create payment session. Please try again." };
  }

  return { ok: true, message: "Redirecting to payment…", stripeUrl: session.url };
}
