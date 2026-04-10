import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { hashPortalAccessToken } from "@/lib/portal/access-token";

export async function POST(request: NextRequest) {
  let body: { documentId: string; portalToken: string; signerName: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { documentId, portalToken, signerName } = body;

  if (!documentId || !portalToken || !signerName) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ ok: true, message: "Demo: Document signed." });
  }

  const hdrs = await headers();
  const clientIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await enforceRateLimit({
    scope: "portal:sign:api",
    actor: clientIp,
    limit: 20,
    windowSeconds: 300,
    strict: true,
  });
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429 });
  }

  const orgId = await getPublicOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Service not available." }, { status: 503 });
  }

  const { blockDemoWrites } = await import("@/lib/demo/guard");
  const demoCheck = await blockDemoWrites(orgId);
  if (demoCheck.blocked) {
    return NextResponse.json({ error: demoCheck.message }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();
  const tokenHash = hashPortalAccessToken(portalToken);

  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("organization_id", orgId)
    .eq("portal_access_token_hash", tokenHash)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Invalid portal link." }, { status: 403 });
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, document_status")
    .eq("id", documentId)
    .eq("order_id", order.id)
    .maybeSingle();

  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (doc.document_status === "signed") {
    return NextResponse.json({ error: "This document has already been signed." }, { status: 409 });
  }

  const signerIp = clientIp;
  const signerUserAgent = hdrs.get("user-agent") ?? null;

  const { error, count } = await supabase
    .from("documents")
    .update({
      document_status: "signed",
      signed_date: new Date().toISOString(),
      signer_name: signerName,
      signer_ip: signerIp,
      signer_user_agent: signerUserAgent,
    })
    .eq("id", documentId)
    .eq("document_status", "pending");

  if (error) {
    return NextResponse.json({ error: "Failed to sign document." }, { status: 500 });
  }

  if (count === 0) {
    return NextResponse.json({ error: "This document has already been signed." }, { status: 409 });
  }

  return NextResponse.json({ ok: true, message: "Document signed successfully." });
}
