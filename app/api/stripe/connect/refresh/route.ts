import { NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { hasStripeEnv, getStripe } from "@/lib/stripe/config";
import { getRequestOrigin } from "@/lib/seo/metadata";
import { logAppError } from "@/lib/observability/server";

/**
 * Stripe Connect Express onboarding refresh URL.
 *
 * Account links are single-use and expire after a few minutes —
 * Stripe sends the operator here when the link they're on has gone
 * stale (e.g. they left the tab open). Mint a fresh link for the
 * SAME account and bounce them straight back into the hosted form;
 * falling back to the billing page when anything is off.
 */
export async function GET() {
  const origin = await getRequestOrigin();
  const fallback = `${origin}/dashboard/settings/billing`;

  if (!hasSupabaseEnv() || !hasStripeEnv()) {
    return NextResponse.redirect(fallback);
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
  if (!org?.stripe_connect_account_id) {
    return NextResponse.redirect(fallback);
  }

  try {
    const link = await getStripe().accountLinks.create({
      account: org.stripe_connect_account_id,
      refresh_url: `${origin}/api/stripe/connect/refresh`,
      return_url: `${origin}/api/stripe/connect/return`,
      type: "account_onboarding",
    });
    return NextResponse.redirect(link.url);
  } catch (err) {
    await logAppError({
      organizationId: ctx.organizationId,
      source: "stripe.connect.refresh_link",
      message: "Fresh account link failed on refresh",
      error: err,
    });
    return NextResponse.redirect(fallback);
  }
}
