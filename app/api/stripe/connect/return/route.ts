import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getOrgContext } from "@/lib/auth/org-context";
import { hasStripeEnv, getStripe } from "@/lib/stripe/config";
import { syncConnectAccountToOrg } from "@/lib/stripe/connect";
import { getRequestOrigin } from "@/lib/seo/metadata";
import { logAppError } from "@/lib/observability/server";

/**
 * Stripe Connect Express onboarding return URL.
 *
 * Stripe sends the operator here when they complete (or exit) the
 * hosted onboarding form. Reaching this URL does NOT mean onboarding
 * succeeded — the only truth is the account object — so we retrieve
 * it and mirror the state onto the org row before showing the
 * billing page, which renders the resulting status.
 *
 * Auth: requires the operator's session (the same browser that
 * started onboarding). Without one we bounce to login; the webhook
 * will still sync the account state out-of-band.
 */
export async function GET() {
  const origin = await getRequestOrigin();

  if (!hasSupabaseEnv() || !hasStripeEnv()) {
    return NextResponse.redirect(`${origin}/dashboard/settings/billing`);
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.redirect(`${origin}/login`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("stripe_connect_account_id")
    .eq("id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (org?.stripe_connect_account_id) {
    try {
      const account = await getStripe().accounts.retrieve(org.stripe_connect_account_id);
      const writeClient = hasSupabaseServiceRoleEnv()
        ? createSupabaseAdminClient()
        : supabase;
      await syncConnectAccountToOrg(writeClient, ctx.organizationId, account);
    } catch (err) {
      // Non-fatal: the billing page will show the last-synced state
      // and the account.updated webhook will catch up.
      await logAppError({
        organizationId: ctx.organizationId,
        source: "stripe.connect.return",
        message: "Status sync on onboarding return failed",
        error: err,
      });
    }
  }

  return NextResponse.redirect(
    `${origin}/dashboard/settings/billing?connect=returned`
  );
}
