import { NextRequest, NextResponse } from "next/server";
import { verifyEmailViewToken } from "@/lib/email/view-token";
import { createSupabaseAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Public "view this email in your browser" route. Verifies an HMAC token
 * against `EMAIL_VIEW_SECRET`, looks up the matching `communication_log`
 * row, and renders the archived HTML body stored in
 * `metadata.html`.
 *
 * The HMAC is over the row id — short, opaque, not enumerable. There's
 * no expiry because these are archival reads; if an operator needs to
 * stop serving an archived message they can null out the row's
 * `metadata.html`.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const id = verifyEmailViewToken(token);
  if (!id) {
    return new NextResponse("Invalid or expired link.", { status: 404 });
  }
  if (!hasSupabaseServiceRoleEnv()) {
    return new NextResponse("Not available.", { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin
    .from("communication_log")
    .select("metadata")
    .eq("id", id)
    .eq("channel", "email")
    .maybeSingle();

  const html = (row?.metadata as { html?: string } | null)?.html;
  if (!html) {
    return new NextResponse("Email content not archived.", { status: 404 });
  }

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      // Prevent the archived email from being framed by third parties.
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
    },
  });
}
