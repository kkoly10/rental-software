"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { blockDemoWrites } from "@/lib/demo/guard";
import { hashPortalAccessToken, isPortalTokenExpired } from "@/lib/portal/access-token";

export type SignDocumentState = {
  ok: boolean;
  message: string;
};

export async function signDocument(
  _prevState: SignDocumentState,
  formData: FormData
): Promise<SignDocumentState> {
  const documentId = String(formData.get("document_id") ?? "").trim();
  const portalToken = String(formData.get("portal_token") ?? "").trim();
  const rawSignerName = String(formData.get("signer_name") ?? "").trim();
  const signerName = rawSignerName.slice(0, 200);
  const agreed = formData.get("agreed") === "on";
  const rawSignatureDataUrl = String(formData.get("signature_data_url") ?? "").trim();
  // Only accept valid PNG data URLs; discard anything malformed
  const signatureDataUrl =
    rawSignatureDataUrl.startsWith("data:image/png;base64,") &&
    rawSignatureDataUrl.length < 300_000
      ? rawSignatureDataUrl
      : null;

  if (!documentId || !portalToken || !signerName) {
    return { ok: false, message: "All fields are required." };
  }

  if (!agreed) {
    return { ok: false, message: "You must agree to the terms before signing." };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: "Demo mode: Document signed successfully.",
    };
  }

  try {
    const clientKey = await getActionClientKey();
    const [clientLimit, tokenLimit] = await Promise.all([
      enforceRateLimit({
        scope: "portal:sign:client",
        actor: clientKey,
        limit: 20,
        windowSeconds: 300,
        strict: true,
      }),
      enforceRateLimit({
        scope: "portal:sign:token",
        actor: hashPortalAccessToken(portalToken),
        limit: 15,
        windowSeconds: 300,
        strict: true,
      }),
    ]);

    if (!clientLimit.allowed || !tokenLimit.allowed) {
      return { ok: false, message: "Too many attempts. Please wait a moment." };
    }
  } catch {
    return { ok: false, message: "Unable to process your request right now." };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) {
    return { ok: false, message: "Service not available." };
  }

  const demoCheck = await blockDemoWrites(orgId);
  if (demoCheck.blocked) {
    return { ok: false, message: demoCheck.message };
  }

  // Customer signs are anon. Service-role bypasses RLS; org isolation is
  // enforced by the explicit .eq("organization_id", orgId) below.
  if (!hasSupabaseServiceRoleEnv()) {
    return { ok: false, message: "Service not available." };
  }
  const supabase = createSupabaseAdminClient();

  const tokenHash = hashPortalAccessToken(portalToken);
  const { data: order } = await supabase
    .from("orders")
    .select("id, portal_access_token_created_at")
    .eq("organization_id", orgId)
    .eq("portal_access_token_hash", tokenHash)
    .maybeSingle();

  if (!order) {
    return {
      ok: false,
      message: "Invalid portal access. Please reopen your portal link.",
    };
  }
  if (isPortalTokenExpired(order.portal_access_token_created_at)) {
    return { ok: false, message: "This portal link has expired. Contact us for a new one." };
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, document_status")
    .eq("id", documentId)
    .eq("order_id", order.id)
    .maybeSingle();

  if (!doc) {
    return { ok: false, message: "Document not found." };
  }

  if (doc.document_status === "signed") {
    return { ok: false, message: "This document has already been signed." };
  }

  const hdrs = await headers();
  const signerIp = hdrs.get("x-real-ip") ?? hdrs.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? null;
  const signerUserAgent = hdrs.get("user-agent") ?? null;

  const { data: updated, error } = await supabase
    .from("documents")
    .update({
      document_status: "signed",
      signed_date: new Date().toISOString(),
      signer_name: signerName,
      signer_ip: signerIp,
      signer_user_agent: signerUserAgent,
      ...(signatureDataUrl ? { signature_data_url: signatureDataUrl } : {}),
    })
    .eq("id", documentId)
    .eq("document_status", "pending")
    .select("id");

  if (error) {
    return {
      ok: false,
      message: "Failed to sign the document. Please try again.",
    };
  }

  // If no rows were updated, the document was already signed by a concurrent request
  if (!updated || updated.length === 0) {
    return { ok: false, message: "This document has already been signed." };
  }

  // Revalidate portal and dashboard so document status shows as signed immediately
  revalidatePath("/order-status");
  revalidatePath(`/dashboard/orders/${order.id}`);
  revalidatePath("/dashboard/documents");

  // #398 Awaited so the Lambda doesn't terminate before the notification
  // insert completes — fire-and-forget here drops operator alerts.
  try {
    const { createNotification } = await import("@/lib/data/notifications");
    await createNotification(
      orgId,
      "new_message",
      "Document signed",
      `${signerName} signed a document`,
      `/dashboard/orders/${order.id}`
    );
  } catch (err) {
    console.error("[sign-document] notify operator failed:", err instanceof Error ? err.message : err);
  }

  return { ok: true, message: "Document signed successfully." };
}
