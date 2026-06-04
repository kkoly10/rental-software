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

// Document lifecycle state machine. Orders enforce transitions; documents
// did not, which let an operator move a document through nonsensical
// sequences like signed → void → sent → pending → signed again — the audit
// trail would show the first signature but the row could be re-signed
// later. Mirror the orders-actions VALID_TRANSITIONS shape so reviewers
// don't have to learn two patterns.
const DOC_VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["sent", "void"],
  sent: ["signed", "void"],
  // signed → void is allowed only as an explicit revoke. Re-issue is a new
  // row, not a status flip back to pending/sent.
  signed: ["void"],
  void: [],
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

  // Fetch the order_id, the parent order status, AND the current document
  // status. The order check guards against editing docs on cancelled/
  // completed orders; the document_status check feeds the VALID_TRANSITIONS
  // table below.
  const { data: docRecord } = await supabase
    .from("documents")
    .select("order_id, document_status, orders!inner(order_status)")
    .eq("id", parsed.data.documentId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!docRecord) {
    return { ok: false, message: "Document not found." };
  }

  const orderStatus = (docRecord.orders as unknown as { order_status: string } | null)?.order_status ?? null;
  const TERMINAL = new Set(["cancelled", "refunded", "completed"]);
  if (orderStatus && TERMINAL.has(orderStatus)) {
    return {
      ok: false,
      message: `Cannot modify documents on a ${orderStatus} order.`,
    };
  }

  const currentStatus = (docRecord.document_status as string | null) ?? "pending";
  const allowed = DOC_VALID_TRANSITIONS[currentStatus];
  if (!allowed) {
    return {
      ok: false,
      message: `Document is in an unrecognized status (${currentStatus}).`,
    };
  }
  if (currentStatus === parsed.data.newStatus) {
    // Idempotent no-op — UI buttons sometimes double-fire.
    return { ok: true, message: `Document is already ${currentStatus}.` };
  }
  if (!allowed.includes(parsed.data.newStatus)) {
    return {
      ok: false,
      message: `Cannot move a ${currentStatus} document to ${parsed.data.newStatus}.`,
    };
  }

  // Re-audit follow-up — the initial terminal-order check above was a
  // read-time snapshot. Re-read the parent order status immediately
  // before the update to narrow the TOCTOU window between "saw the
  // order open" and "wrote to the document". Doesn't fully close it
  // (the document update isn't transactional with the order read) but
  // catches the common case of the operator cancelling the order in a
  // second tab while this one was open.
  if (docRecord.order_id) {
    const { data: latestOrder } = await supabase
      .from("orders")
      .select("order_status")
      .eq("id", docRecord.order_id)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    const latestStatus = latestOrder?.order_status ?? null;
    if (latestStatus && TERMINAL.has(latestStatus)) {
      return {
        ok: false,
        message: `Cannot modify documents on a ${latestStatus} order.`,
      };
    }
  }

  // Scope the UPDATE to the document_status we just read so a concurrent
  // status change can't slip a stale transition through.
  const { data: updated, error } = await supabase
    .from("documents")
    .update(updateData)
    .eq("id", parsed.data.documentId)
    .eq("organization_id", ctx.organizationId)
    .eq("document_status", currentStatus)
    .select("id");

  if (error) {
    return { ok: false, message: error.message };
  }
  if (!updated || updated.length === 0) {
    return {
      ok: false,
      message: "Document status changed in another tab. Please refresh.",
    };
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