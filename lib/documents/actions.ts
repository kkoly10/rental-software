"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { revalidatePath } from "next/cache";

export type DocumentActionState = {
  ok: boolean;
  message: string;
};

export async function updateDocumentStatus(
  documentId: string,
  newStatus: string
): Promise<DocumentActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: `Demo mode: Document would be marked ${newStatus}.` };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();

  const updateData: Record<string, unknown> = { document_status: newStatus };
  if (newStatus === "signed") {
    updateData.signed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("documents")
    .update(updateData)
    .eq("id", documentId)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/documents");
  return { ok: true, message: `Document marked as ${newStatus}.` };
}

export async function createDocumentsForOrder(
  orderId: string
): Promise<DocumentActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Documents would be created." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();

  // Get order's customer
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id")
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!order) {
    return { ok: false, message: "Order not found." };
  }

  // Check if documents already exist
  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("order_id", orderId)
    .limit(1);

  if (existing && existing.length > 0) {
    return { ok: false, message: "Documents already exist for this order." };
  }

  // Create rental agreement + safety waiver
  const { error } = await supabase.from("documents").insert([
    {
      organization_id: ctx.organizationId,
      order_id: orderId,
      customer_id: order.customer_id,
      document_type: "rental_agreement",
      document_status: "pending",
    },
    {
      organization_id: ctx.organizationId,
      order_id: orderId,
      customer_id: order.customer_id,
      document_type: "safety_waiver",
      document_status: "pending",
    },
  ]);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/documents");
  revalidatePath(`/dashboard/orders/${orderId}`);
  return { ok: true, message: "Rental agreement and safety waiver created." };
}
