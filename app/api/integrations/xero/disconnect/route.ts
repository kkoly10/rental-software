import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { revokeTokens } from "@/lib/integrations/xero/client";
import {
  clearXeroConnection,
  loadXeroConnection,
} from "@/lib/integrations/xero/connection";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export async function POST(_request: NextRequest) {
  if (!hasSupabaseEnv()) return NextResponse.json({ error: "Not configured" }, { status: 503 });

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
    return NextResponse.json({ error: "Only owners and admins can disconnect Xero." }, { status: 403 });
  }

  const connection = await loadXeroConnection(supabase, ctx.organizationId);
  if (connection) {
    try {
      await revokeTokens(connection.refreshToken);
    } catch (err) {
      console.error("[xero.disconnect] revoke failed:", err instanceof Error ? err.message : err);
    }
  }
  await clearXeroConnection(supabase, ctx.organizationId);

  const siteUrl = await getSiteUrl();
  return NextResponse.redirect(`${siteUrl}/dashboard/settings?xero=disconnected`, { status: 303 });
}
