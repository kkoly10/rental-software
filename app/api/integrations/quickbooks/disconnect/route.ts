import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { revokeTokens } from "@/lib/integrations/quickbooks/client";
import {
  clearQboConnection,
  loadQboConnection,
} from "@/lib/integrations/quickbooks/connection";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

/**
 * POST /api/integrations/quickbooks/disconnect
 *
 * Owner/admin-only. Revokes the refresh token at Intuit (best-effort)
 * and clears the local connection columns. Operator lands back at the
 * Integrations card.
 */
export async function POST(_request: NextRequest) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
    return NextResponse.json(
      { error: "Only owners and admins can disconnect QuickBooks." },
      { status: 403 },
    );
  }

  // Revoke at Intuit first so a leaked token can't keep being used.
  // Failure here doesn't block local cleanup — the operator still
  // expects the disconnect button to remove the connection from
  // their dashboard.
  const connection = await loadQboConnection(supabase, ctx.organizationId);
  if (connection) {
    try {
      await revokeTokens(connection.refreshToken);
    } catch (err) {
      console.error(
        "[qbo.disconnect] revoke failed:",
        err instanceof Error ? err.message : err,
      );
    }
  }

  await clearQboConnection(supabase, ctx.organizationId);

  const siteUrl = await getSiteUrl();
  return NextResponse.redirect(
    `${siteUrl}/dashboard/settings?qbo=disconnected`,
    { status: 303 },
  );
}
