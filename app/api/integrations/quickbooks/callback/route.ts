import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { exchangeCodeForTokens } from "@/lib/integrations/quickbooks/client";
import { hasQuickBooksEnv } from "@/lib/integrations/quickbooks/config";
import { persistQboConnection } from "@/lib/integrations/quickbooks/connection";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

/**
 * GET /api/integrations/quickbooks/callback
 *
 * The OAuth redirect target. Intuit hands back `code`, `state`, and
 * `realmId`. We verify state against the cookie, exchange the code,
 * and stash the tokens on the org. Operator lands back at the
 * Integrations settings page with a success or failure banner.
 */
export async function GET(request: NextRequest) {
  const siteUrl = await getSiteUrl();
  const settingsUrl = `${siteUrl}/dashboard/settings`;

  if (!hasSupabaseEnv() || !hasQuickBooksEnv()) {
    return NextResponse.redirect(
      `${settingsUrl}?qbo=not_configured`,
    );
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.redirect(`${siteUrl}/login`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (membership?.role !== "owner" && membership?.role !== "admin") {
    return NextResponse.redirect(`${settingsUrl}?qbo=forbidden`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const realmId = url.searchParams.get("realmId");
  const error = url.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${settingsUrl}?qbo=error&detail=${encodeURIComponent(error)}`,
    );
  }
  if (!code || !state || !realmId) {
    return NextResponse.redirect(`${settingsUrl}?qbo=missing_params`);
  }

  const expectedState = request.cookies.get("qbo_oauth_state")?.value;
  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(`${settingsUrl}?qbo=state_mismatch`);
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code, realmId);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      `${settingsUrl}?qbo=token_exchange_failed&detail=${encodeURIComponent(detail.slice(0, 200))}`,
    );
  }

  const persisted = await persistQboConnection(
    supabase,
    ctx.organizationId,
    tokens,
  );
  if (!persisted.ok) {
    return NextResponse.redirect(
      `${settingsUrl}?qbo=persist_failed&detail=${encodeURIComponent((persisted.message ?? "").slice(0, 200))}`,
    );
  }

  const response = NextResponse.redirect(`${settingsUrl}?qbo=connected`);
  // Burn the CSRF cookie so a replay can't piggyback.
  response.cookies.set("qbo_oauth_state", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/quickbooks",
    maxAge: 0,
  });
  return response;
}
