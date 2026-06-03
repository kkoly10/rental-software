import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { buildAuthorizeUrl, generatePkcePair } from "@/lib/integrations/xero/client";
import { hasXeroEnv } from "@/lib/integrations/xero/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Owner/admin-only OAuth kickoff for Xero. Generates a PKCE pair +
 * CSRF state, persists both in HTTP-only cookies, and redirects to
 * Xero's authorize URL.
 *
 * Two cookies because PKCE and state serve different purposes:
 *   - `xero_oauth_state`: CSRF protection (caller-supplied opaque
 *     value verified in the callback)
 *   - `xero_oauth_verifier`: PKCE secret that proves we're the same
 *     client that initiated the request
 *
 * Both cookies are scoped to `/api/integrations/xero` and live for 10
 * minutes — long enough for the user to complete the Xero grant but
 * short enough that a leaked state can't be replayed indefinitely.
 */
export async function GET(_request: NextRequest) {
  if (!hasSupabaseEnv()) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  if (!hasXeroEnv()) {
    return NextResponse.json(
      { error: "Xero integration is not configured on this deploy." },
      { status: 503 },
    );
  }

  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (membership?.role !== "owner" && membership?.role !== "admin") {
    return NextResponse.json({ error: "Only owners and admins can connect Xero." }, { status: 403 });
  }

  const state = randomBytes(24).toString("base64url");
  const { verifier, challenge } = generatePkcePair();
  const authorizeUrl = buildAuthorizeUrl(state, challenge);

  const response = NextResponse.redirect(authorizeUrl);
  const cookieBase = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/xero",
    maxAge: 10 * 60,
  };
  // Pin the initiating user into the state cookie. Without this, a
  // shared device where user A starts a flow and user B finishes it
  // would attach Xero tokens to user B's org context. Format mirrors
  // the QBO route: `${state}:${userId}`. The verifier stays opaque
  // (it's already a PKCE secret bound to this client by virtue of
  // being a per-flow secret).
  response.cookies.set("xero_oauth_state", `${state}:${ctx.userId}`, cookieBase);
  response.cookies.set("xero_oauth_verifier", verifier, cookieBase);
  return response;
}
