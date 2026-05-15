"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import {
  createOrderDocumentsSchema,
  updateDocumentStatusSchema,
} from "@/lib/validation/documents";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export type DocumentActionState = {
  ok: boolean;
  message: string;
};

export async function updateDocumentStatus(
  documentId: string,
  newStatus: string
): Promise<DocumentActionState> {
  const parsed = updateDocumentStatusSchema.safeParse({
    documentId,
    newStatus,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid document update request.",
    };
  }

  if (!hasSupabaseEnv()) {
    return {
      ok: true,
      message: `Demo mode: Document would be marked ${parsed.data.newStatus}.`,
    };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  try {
    const userLimit = await enforceRateLimit({
      scope: "documents:update-status:user",
      actor: ctx.userId,
      limit: 60,
      windowSeconds: 300,
    });

    if (!userLimit.allowed) {
      return {
        ok: false,
        message: "Too many document updates. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to update document status right now. Please try again shortly.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: docUpdateMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(docUpdateMembership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to update document status." };
  }

  const updateData: Record<string, unknown> = {
    document_status: parsed.data.newStatus,
  };

  if (parsed.data.newStatus === "signed") {
    updateData.signed_date = new Date().toISOString();
  }

  // Fetch the order_id before updating so we can revalidate the order detail page
  const { data: docRecord } = await supabase
    .from("documents")
    .select("order_id")
    .eq("id", parsed.data.documentId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  const { error } = await supabase
    .from("documents")
    .update(updateData)
    .eq("id", parsed.data.documentId)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/documents");
  if (docRecord?.order_id) {
    revalidatePath(`/dashboard/orders/${docRecord.order_id}`);
  }
  return {
    ok: true,
    message: `Document marked as ${parsed.data.newStatus}.`,
  };
}

export async function createDocumentsForOrder(
  orderId: string
): Promise<DocumentActionState> {
  const parsed = createOrderDocumentsSchema.safeParse({ orderId });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid document creation request.",
    };
  }

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Documents would be created." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  try {
    const userLimit = await enforceRateLimit({
      scope: "documents:create:user",
      actor: ctx.userId,
      limit: 25,
      windowSeconds: 300,
    });

    if (!userLimit.allowed) {
      return {
        ok: false,
        message: "Too many document creation attempts. Please wait and try again.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Unable to create documents right now. Please try again shortly.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: docCreateMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(docCreateMembership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to create documents." };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id")
    .eq("id", parsed.data.orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) {
    return { ok: false, message: "Order not found." };
  }

  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("order_id", parsed.data.orderId)
    .eq("organization_id", ctx.organizationId)
    .limit(1);

  if (existing && existing.length > 0) {
    return { ok: false, message: "Documents already exist for this order." };
  }

  const { error } = await supabase.from("documents").insert([
    {
      organization_id: ctx.organizationId,
      order_id: parsed.data.orderId,
      customer_id: order.customer_id,
      document_type: "rental_agreement",
      document_status: "pending",
    },
    {
      organization_id: ctx.organizationId,
      order_id: parsed.data.orderId,
      customer_id: order.customer_id,
      document_type: "safety_waiver",
      document_status: "pending",
    },
  ]);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/documents");
  revalidatePath(`/dashboard/orders/${parsed.data.orderId}`);

  try {
    const { triggerDocumentsReadyEmail } = await import("@/lib/email/triggers");
    await triggerDocumentsReadyEmail({
      organizationId: ctx.organizationId,
      orderId: parsed.data.orderId,
      customerId: order.customer_id,
      documentTypes: ["rental_agreement", "safety_waiver"],
    });
  } catch (err) {
    console.error("[documents] Failed to send documents-ready email for order", parsed.data.orderId, err instanceof Error ? err.message : err);
  }

  return {
    ok: true,
    message: "Rental agreement and safety waiver created.",
  };
}