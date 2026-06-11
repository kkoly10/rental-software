"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth/org-context";
import { hasStripeEnv, getStripe } from "@/lib/stripe/config";
import { getRequestOrigin } from "@/lib/seo/metadata";
import { syncConnectAccountToOrg } from "@/lib/stripe/connect";
import { logAppError, logAppEvent } from "@/lib/observability/server";

export type ConnectActionState = { ok: boolean; message: string };

/** Only owners/admins may touch the org's payment plumbing — same
 *  bar as team management. Dispatchers/crew see the status card
 *  read-only. */
async function requirePaymentsManager(): Promise<
  | { ok: true; organizationId: string }
  | { ok: false; message: string }
> {
  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Sign in required." };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (data?.role !== "owner" && data?.role !== "admin") {
    return { ok: false, message: "Only owners and admins can manage payment settings." };
  }
  return { ok: true, organizationId: ctx.organizationId };
}

function adminWriteClientOrNull() {
  // organizations RLS allows owner/admin updates (and every caller is
  // gated by requirePaymentsManager), but the connect columns are
  // payment-critical — prefer the admin client so a future RLS
  // tightening can't silently strand the sync. Returns null when no
  // service-role env; callers fall back to the session client, which
  // is safe because of the owner/admin gate.
  return hasSupabaseServiceRoleEnv()
    ? createSupabaseAdminClient()
    : null;
}

/**
 * Begin (or resume) Stripe Connect Express onboarding.
 *
 * Creates the Express account on first call (idempotent thereafter —
 * the acct id persists even if the operator abandons the Stripe
 * form), then redirects into a fresh Stripe-hosted account link.
 * Stripe account links are single-use and short-lived, so we mint a
 * new one on every call rather than storing them.
 */
export async function startStripeConnectOnboarding(): Promise<ConnectActionState> {
  if (!hasSupabaseEnv()) return { ok: false, message: "Demo mode: Stripe onboarding unavailable." };
  if (!hasStripeEnv()) {
    return { ok: false, message: "Stripe is not configured on this deployment." };
  }

  const gate = await requirePaymentsManager();
  if (!gate.ok) return gate;
  const orgId = gate.organizationId;

  const supabase = await createSupabaseServerClient();
  const admin = adminWriteClientOrNull() ?? supabase;

  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_connect_account_id, support_email, name")
    .eq("id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!org) return { ok: false, message: "Organization not found." };

  const stripe = getStripe();
  let accountId = org.stripe_connect_account_id;

  if (!accountId) {
    try {
      const account = await stripe.accounts.create({
        type: "express",
        email: org.support_email ?? undefined,
        business_profile: { name: org.name ?? undefined },
        metadata: { organization_id: orgId },
      });
      accountId = account.id;
    } catch (err) {
      await logAppError({
        organizationId: orgId,
        source: "stripe.connect.create_account",
        message: "Express account creation failed",
        error: err,
      });
      return { ok: false, message: "We couldn't start Stripe onboarding. Please try again." };
    }

    const { error: saveError } = await admin
      .from("organizations")
      .update({ stripe_connect_account_id: accountId })
      .eq("id", orgId);
    if (saveError) {
      // Account exists at Stripe but we failed to record it — loud
      // log so support can re-link rather than creating a duplicate.
      await logAppError({
        organizationId: orgId,
        source: "stripe.connect.save_account",
        message: "Created Express account but failed to persist acct id",
        context: { accountId, reason: saveError.message },
      });
      return { ok: false, message: "Something went wrong saving your Stripe account. Contact support." };
    }

    await logAppEvent({
      organizationId: orgId,
      source: "stripe.connect",
      action: "express_account_created",
      status: "info",
      metadata: { accountId },
    });
  }

  const origin = await getRequestOrigin();
  let url: string;
  try {
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/api/stripe/connect/refresh`,
      return_url: `${origin}/api/stripe/connect/return`,
      type: "account_onboarding",
    });
    url = link.url;
  } catch (err) {
    await logAppError({
      organizationId: orgId,
      source: "stripe.connect.account_link",
      message: "Account link creation failed",
      context: { accountId },
      error: err,
    });
    return { ok: false, message: "We couldn't open Stripe onboarding. Please try again." };
  }

  redirect(url);
}

/**
 * Express dashboard login link — lets a connected operator view
 * payouts/balance on Stripe without full dashboard credentials.
 */
export async function openStripeExpressDashboard(): Promise<ConnectActionState> {
  if (!hasStripeEnv()) return { ok: false, message: "Stripe is not configured." };

  const gate = await requirePaymentsManager();
  if (!gate.ok) return gate;

  const supabase = await createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_connect_account_id")
    .eq("id", gate.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!org?.stripe_connect_account_id) {
    return { ok: false, message: "Connect a Stripe account first." };
  }

  let url: string;
  try {
    const link = await getStripe().accounts.createLoginLink(org.stripe_connect_account_id);
    url = link.url;
  } catch (err) {
    await logAppError({
      organizationId: gate.organizationId,
      source: "stripe.connect.login_link",
      message: "Express login link failed",
      error: err,
    });
    return { ok: false, message: "We couldn't open your Stripe dashboard. Please try again." };
  }
  redirect(url);
}

/**
 * Pull the live account state from Stripe and mirror it onto the
 * org row. The account.updated webhook normally does this, but the
 * button gives operators a "check again" affordance when they've
 * just finished verification and don't want to wait.
 */
export async function refreshStripeConnectStatus(): Promise<ConnectActionState> {
  if (!hasStripeEnv()) return { ok: false, message: "Stripe is not configured." };

  const gate = await requirePaymentsManager();
  if (!gate.ok) return gate;

  const supabase = await createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_connect_account_id")
    .eq("id", gate.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!org?.stripe_connect_account_id) {
    return { ok: false, message: "Connect a Stripe account first." };
  }

  try {
    const account = await getStripe().accounts.retrieve(org.stripe_connect_account_id);
    const admin = adminWriteClientOrNull() ?? supabase;
    await syncConnectAccountToOrg(admin, gate.organizationId, account);
  } catch (err) {
    await logAppError({
      organizationId: gate.organizationId,
      source: "stripe.connect.refresh",
      message: "Connect status refresh failed",
      error: err,
    });
    return { ok: false, message: "We couldn't reach Stripe. Please try again." };
  }

  revalidatePath("/dashboard/settings/billing");
  revalidatePath("/dashboard");
  return { ok: true, message: "Payment status updated." };
}
