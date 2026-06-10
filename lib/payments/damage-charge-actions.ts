"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { hasStripeEnv, getStripe } from "@/lib/stripe/config";
import { logAppError, logAppEvent } from "@/lib/observability/server";

export type DamageChargeState = { ok: boolean; message: string };

/**
 * PR-2c — operator-initiated post-event damage charge.
 *
 * Charges the customer's saved card off-session for damage / late
 * return / cleaning fees AFTER the event. Cards land in
 * payment_methods via the payment_method.attached webhook when the
 * customer's deposit ran with setup_future_usage=on_session.
 *
 * Architecture:
 *  - Direct charge on the operator's connected account (mirrors the
 *    deposit flow). Operator keeps the funds; Korent takes no fee.
 *  - Records the result in the payments table with payment_type=
 *    'damage_charge' so financials / invoices reflect the post-event
 *    revenue.
 *  - Success message reports the charge state (succeeded vs.
 *    requires_action / authentication) so the operator can chase if
 *    SCA gates the off-session attempt.
 */
export async function chargeCustomerCardForDamage(
  _prev: DamageChargeState,
  formData: FormData
): Promise<DamageChargeState> {
  const orderId = String(formData.get("order_id") ?? "").trim();
  const paymentMethodId = String(formData.get("payment_method_id") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  if (!orderId) return { ok: false, message: "Order is required." };
  if (!paymentMethodId) return { ok: false, message: "Pick a saved card to charge." };
  if (!reason) return { ok: false, message: "Please describe what the charge is for." };

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: "Amount must be greater than 0." };
  }

  if (!hasSupabaseEnv()) return { ok: true, message: "Demo mode: charge would be issued." };
  if (!hasStripeEnv()) return { ok: false, message: "Stripe is not configured." };

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Sign in required." };

  const readClient = await createSupabaseServerClient();
  const writeClient = hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : readClient;

  // Resolve the customer's connected-account Stripe id + the org's
  // Connect account id in one shot.
  const { data: order } = await readClient
    .from("orders")
    .select(
      "id, customer_id, organization_id, customers(stripe_customer_id), organizations(stripe_connect_account_id, default_currency)"
    )
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!order) return { ok: false, message: "Order not found." };

  const customerJoin = (order as { customers?: unknown }).customers;
  const customerRow = Array.isArray(customerJoin) ? customerJoin[0] : customerJoin;
  const stripeCustomerId =
    (customerRow as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;
  const orgJoin = (order as { organizations?: unknown }).organizations;
  const orgRow = Array.isArray(orgJoin) ? orgJoin[0] : orgJoin;
  const connectAccountId =
    (orgRow as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id ?? null;
  const currency =
    ((orgRow as { default_currency?: string | null } | null)?.default_currency ?? "usd").toLowerCase();

  if (!stripeCustomerId || !connectAccountId) {
    return {
      ok: false,
      message:
        "This order doesn't have a saved card on file. Send the customer a manual invoice instead.",
    };
  }

  // Verify the payment method belongs to the org's customer record —
  // never trust the form value blindly.
  const { data: pmRow } = await readClient
    .from("payment_methods")
    .select("id, stripe_payment_method_id, customer_id, organization_id")
    .eq("id", paymentMethodId)
    .eq("organization_id", ctx.organizationId)
    .eq("customer_id", (order as { customer_id: string }).customer_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!pmRow) {
    return { ok: false, message: "That saved card isn't on file for this customer." };
  }

  const stripe = getStripe();
  let intent;
  try {
    intent = await stripe.paymentIntents.create(
      {
        amount: Math.round(amount * 100),
        currency,
        customer: stripeCustomerId,
        payment_method: pmRow.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        description: `Post-event damage charge — order ${orderId}: ${reason.slice(0, 200)}`,
        metadata: {
          order_id: orderId,
          organization_id: ctx.organizationId,
          payment_type: "damage_charge",
        },
      },
      { stripeAccount: connectAccountId }
    );
  } catch (err) {
    // off-session auth challenge → Stripe throws with code
    // 'authentication_required'; surface that explicitly so the
    // operator emails an invoice link instead.
    const code = (err as { code?: string })?.code;
    if (code === "authentication_required") {
      await logAppEvent({
        organizationId: ctx.organizationId,
        source: "payments.damage_charge",
        action: "sca_required",
        status: "warning",
        metadata: { orderId, amount },
      });
      return {
        ok: false,
        message:
          "The card requires the customer to authenticate this charge. Send an invoice link instead.",
      };
    }
    await logAppError({
      organizationId: ctx.organizationId,
      source: "payments.damage_charge",
      message: "Stripe damage charge failed",
      context: { orderId, amount, code },
      error: err,
    });
    return {
      ok: false,
      message:
        err instanceof Error
          ? `Stripe rejected the charge: ${err.message}`
          : "Stripe rejected the charge.",
    };
  }

  const status = intent.status === "succeeded" ? "paid" : "pending";

  const { error: insertError } = await writeClient.from("payments").insert({
    order_id: orderId,
    provider: "stripe",
    provider_payment_id: intent.id,
    payment_type: "damage_charge",
    payment_status: status,
    amount,
    paid_at: status === "paid" ? new Date().toISOString() : null,
    payment_method: "card",
    reference_note: reason,
  });

  if (insertError && !/duplicate key/i.test(insertError.message)) {
    await logAppError({
      organizationId: ctx.organizationId,
      source: "payments.damage_charge.insert",
      message: "Damage-charge insert failed after Stripe success",
      context: { orderId, paymentIntentId: intent.id, reason: insertError.message },
    });
    return {
      ok: false,
      message:
        "Charge succeeded on Stripe but we couldn't record it locally. Check the Stripe dashboard and contact support.",
    };
  }

  await logAppEvent({
    organizationId: ctx.organizationId,
    source: "payments.damage_charge",
    action: "stripe_damage_charge_issued",
    status: "info",
    metadata: { orderId, amount, paymentIntentId: intent.id, stripeStatus: intent.status },
  });

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");

  return {
    ok: true,
    message:
      status === "paid"
        ? `Charged $${amount.toFixed(2)} to the customer's saved card.`
        : `Charge of $${amount.toFixed(2)} is pending. We'll update the status when Stripe confirms.`,
  };
}
