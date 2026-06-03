import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import {
  exchangeCodeForTokens,
  fetchFirstTenant,
} from "@/lib/integrations/xero/client";
import { hasXeroEnv } from "@/lib/integrations/xero/config";
import { persistXeroConnection } from "@/lib/integrations/xero/connection";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export async function GET(request: NextRequest) {
  const siteUrl = await getSiteUrl();
  const settingsUrl = `${siteUrl}/dashboard/settings`;

  if (!hasSupabaseEnv() || !hasXeroEnv()) {
    return NextResponse.redirect(`${settingsUrl}?xero=not_configured`);
  }
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.redirect(`${siteUrl}/login`);

  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (membership?.role !== "owner" && membership?.role !== "admin") {
    return NextResponse.redirect(`${settingsUrl}?xero=forbidden`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(
      `${settingsUrl}?xero=error&detail=${encodeURIComponent(error)}`,
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(`${settingsUrl}?xero=missing_params`);
  }

  // Cookie format set by connect is `${state}:${userId}`. Split,
  // verify state, then verify userId matches the currently-auth user
  // (shared-device defense — same as the QBO route).
  const cookieValue = request.cookies.get("xero_oauth_state")?.value ?? "";
  const verifier = request.cookies.get("xero_oauth_verifier")?.value;
  const sep = cookieValue.indexOf(":");
  const expectedState = sep > 0 ? cookieValue.slice(0, sep) : cookieValue;
  const expectedUserId = sep > 0 ? cookieValue.slice(sep + 1) : "";
  if (!expectedState || expectedState !== state || !verifier) {
    return NextResponse.redirect(`${settingsUrl}?xero=state_mismatch`);
  }
  if (!expectedUserId || expectedUserId !== ctx.userId) {
    return NextResponse.redirect(`${settingsUrl}?xero=user_mismatch`);
  }

  let tokensWithoutTenant;
  try {
    tokensWithoutTenant = await exchangeCodeForTokens(code, verifier);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(
      `${settingsUrl}?xero=token_exchange_failed&detail=${encodeURIComponent(detail.slice(0, 200))}`,
    );
  }

  const tenantId = await fetchFirstTenant(tokensWithoutTenant.accessToken);
  if (!tenantId) {
    return NextResponse.redirect(`${settingsUrl}?xero=no_tenant`);
  }

  const persisted = await persistXeroConnection(supabase, ctx.organizationId, {
    ...tokensWithoutTenant,
    tenantId,
  });
  if (!persisted.ok) {
    return NextResponse.redirect(
      `${settingsUrl}?xero=persist_failed&detail=${encodeURIComponent((persisted.message ?? "").slice(0, 200))}`,
    );
  }

  const response = NextResponse.redirect(`${settingsUrl}?xero=connected`);
  const burn = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/xero",
    maxAge: 0,
  };
  response.cookies.set("xero_oauth_state", "", burn);
  response.cookies.set("xero_oauth_verifier", "", burn);
  return response;
}
