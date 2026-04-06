import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  let body: { documentId: string; orderNumber: string; email: string; signerName: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { documentId, orderNumber, email, signerName } = body;

  if (!documentId || !orderNumber || !email || !signerName) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ ok: true, message: "Demo: Document signed." });
  }

  // Rate limit by IP
  const hdrs = await headers();
  const clientIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    const limit = await enforceRateLimit({
      scope: "portal:sign:api",
      actor: clientIp,
      limit: 20,
      windowSeconds: 300,
    });
    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many attempts. Please wait." }, { status: 429 });
    }
  } catch {
    // Allow through on rate limit infrastructure failure
  }

  const orgId = await getPublicOrgId();
  if (!orgId) {
    return NextResponse.json({ error: "Service not available." }, { status: 503 });
  }

  // Block writes on demo org
  const { blockDemoWrites } = await import("@/lib/demo/guard");
  const demoCheck = await blockDemoWrites(orgId);
  if (demoCheck.blocked) {
    return NextResponse.json({ error: demoCheck.message }, { status: 403 });
  }

  const supabase = await createSupabaseServerClient();

  // Verify order exists and email matches
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id")
    .eq("organization_id", orgId)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("email")
    .eq("id", order.customer_id)
    .maybeSingle();

  if (!customer || customer.email?.toLowerCase() !== email.toLowerCase()) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 403 });
  }

  // Verify document belongs to this order and check current status
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

  // Audit trail
  const signerIp = clientIp;
  const signerUserAgent = hdrs.get("user-agent") ?? null;

  // Atomically update only if still pending (prevents race conditions)
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
