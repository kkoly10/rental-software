import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { buildAuthorizeUrl } from "@/lib/integrations/quickbooks/client";
import { hasQuickBooksEnv } from "@/lib/integrations/quickbooks/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * GET /api/integrations/quickbooks/connect
 *
 * Owner/admin-only kickoff for the QBO OAuth dance. Generates a CSRF
 * state, stashes it in an HTTP-only cookie tied to the user, then
 * redirects to Intuit's authorize page. The callback at
 * /api/integrations/quickbooks/callback verifies the state matches
 * before exchanging the code for tokens.
 */
export async function GET(_request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (!hasQuickBooksEnv()) {
    return NextResponse.json(
      { error: "QuickBooks integration is not configured on this deploy." },
      { status: 503 },
    );
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Owner/admin only — these are the operators who manage billing
  // integrations. Dispatcher and below are excluded because connecting
  // QBO grants Korent the ability to push invoices into the operator's
  // bookkeeping system.
  const supabase = await createSupabaseServerClient();
  const { data: membership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (membership?.role !== "owner" && membership?.role !== "admin") {
    return NextResponse.json(
      { error: "Only owners and admins can connect QuickBooks." },
      { status: 403 },
    );
  }

  // CSRF state: opaque random value sent to Intuit + a cookie payload
  // that also pins the initiating user. Without the user pin, a shared
  // device where user A starts a flow and user B finishes it would land
  // the tokens on whichever org B currently belongs to — not the one A
  // intended. The callback splits on ":" and verifies (a) state matches
  // and (b) userId matches the currently-authenticated profile.
  const state = randomBytes(24).toString("base64url");
  const cookieValue = `${state}:${ctx.userId}`;
  const authorizeUrl = buildAuthorizeUrl(state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("qbo_oauth_state", cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/integrations/quickbooks",
    maxAge: 10 * 60,
  });
  return response;
}
