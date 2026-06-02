import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseAdminClient, hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";
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

  if (signerName.length > 200) {
    return NextResponse.json({ error: "Signer name is too long." }, { status: 400 });
  }

  if (!hasSupabaseEnv()) {
    return NextResponse.json({ ok: true, message: "Demo: Document signed." });
  }

  const hdrs = await headers();
  const { getTrustedClientIp } = await import("@/lib/security/request-client");
  const clientIp = getTrustedClientIp(hdrs);
  let limit: { allowed: boolean };
  try {
    limit = await enforceRateLimit({
      scope: "portal:sign:api",
      actor: clientIp,
      limit: 20,
      windowSeconds: 300,
      strict: true,
    });
  } catch {
    return NextResponse.json({ error: "Service temporarily unavailable." }, { status: 503 });
  }
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

  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Service not available." }, { status: 503 });
  }
  const supabase = createSupabaseAdminClient();
  const tokenHash = hashPortalAccessToken(portalToken);

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, order_number, order_status, customers(first_name, last_name)"
    )
    .eq("organization_id", orgId)
    .eq("portal_access_token_hash", tokenHash)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Invalid portal link." }, { status: 403 });
  }
  if (
    order.order_status === "cancelled" ||
    order.order_status === "refunded" ||
    order.order_status === "completed"
  ) {
    return NextResponse.json(
      { error: "This order is no longer accepting document signatures." },
      { status: 409 }
    );
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

  const { data: signed, error } = await supabase
    .from("documents")
    .update({
      document_status: "signed",
      signed_date: new Date().toISOString(),
      signer_name: signerName,
      signer_ip: signerIp,
      signer_user_agent: signerUserAgent,
    })
    .eq("id", documentId)
    .eq("document_status", "pending")
    .select("id");

  if (error) {
    return NextResponse.json({ error: "Failed to sign document." }, { status: 500 });
  }

  if (!signed || signed.length === 0) {
    return NextResponse.json({ error: "This document has already been signed." }, { status: 409 });
  }

  // #355 Match the server-action variant (lib/portal/sign-document.ts) so the
  // dashboard documents list, order detail, and customer portal all refresh.
  revalidatePath("/dashboard/documents");
  revalidatePath("/dashboard/orders");
  revalidatePath("/order-status");

  // Operator alert (email + in-app bell). Fire-and-forget — the signing
  // itself already succeeded.
  try {
    const cust = (order as unknown as {
      customers?: { first_name?: string | null; last_name?: string | null } | null;
    }).customers;
    const orderNumber = (order as { order_number?: string | null }).order_number ?? order.id;
    const { triggerOperatorActivityAlertEmail } = await import("@/lib/email/triggers");
    await triggerOperatorActivityAlertEmail({
      organizationId: orgId,
      orderId: order.id,
      orderNumber,
      customerName:
        `${cust?.first_name ?? ""} ${cust?.last_name ?? ""}`.trim() || "Customer",
      event: "document_signed",
      detail: `Signed by ${signerName}`,
    });
  } catch (err) {
    console.error("[portal.sign-document] operator alert failed:", err instanceof Error ? err.message : err);
  }

  return NextResponse.json({ ok: true, message: "Document signed successfully." });
}
