"use server";

import { headers } from "next/headers";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export type SignDocumentState = {
  ok: boolean;
  message: string;
};

export async function signDocument(
  _prevState: SignDocumentState,
  formData: FormData
): Promise<SignDocumentState> {
  const documentId = String(formData.get("document_id") ?? "").trim();
  const orderNumber = String(formData.get("order_number") ?? "").trim().toUpperCase();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const signerName = String(formData.get("signer_name") ?? "").trim();
  const agreed = formData.get("agreed") === "on";

  if (!documentId || !orderNumber || !email || !signerName) {
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
    const [clientLimit, emailLimit] = await Promise.all([
      enforceRateLimit({ scope: "portal:sign:client", actor: clientKey, limit: 20, windowSeconds: 300 }),
      enforceRateLimit({ scope: "portal:sign:email", actor: email, limit: 15, windowSeconds: 300 }),
    ]);

    if (!clientLimit.allowed || !emailLimit.allowed) {
      return { ok: false, message: "Too many attempts. Please wait a moment." };
    }
  } catch {
    return { ok: false, message: "Unable to process your request right now." };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) {
    return { ok: false, message: "Service not available." };
  }

  const supabase = await createSupabaseServerClient();

  // Verify order + email match
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id")
    .eq("organization_id", orgId)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) {
    return { ok: false, message: "Order not found." };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("email")
    .eq("id", order.customer_id)
    .maybeSingle();

  if (!customer || customer.email?.toLowerCase() !== email) {
    return { ok: false, message: "Unable to verify your identity." };
  }

  // Verify document belongs to this order
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

  // Collect audit trail from request headers
  const hdrs = await headers();
  const signerIp = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const signerUserAgent = hdrs.get("user-agent") ?? null;

  const { error } = await supabase
    .from("documents")
    .update({
      document_status: "signed",
      signed_date: new Date().toISOString(),
      signer_name: signerName,
      signer_ip: signerIp,
      signer_user_agent: signerUserAgent,
    })
    .eq("id", documentId)
    .eq("document_status", "pending"); // prevent race condition — only sign if still pending

  if (error) {
    return { ok: false, message: "Failed to sign the document. Please try again." };
  }

  return { ok: true, message: "Document signed successfully." };
}
