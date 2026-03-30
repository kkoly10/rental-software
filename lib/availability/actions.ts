"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getAvailabilityWindowForDate } from "./window";

export type AvailabilityActionState = {
  ok: boolean;
  message: string;
};

/**
 * Manually block a product for a date range (maintenance, private hold, etc.)
 */
export async function blockProductDates(
  _prevState: AvailabilityActionState,
  formData: FormData
): Promise<AvailabilityActionState> {
  const productId = String(formData.get("product_id") ?? "");
  const startDate = String(formData.get("start_date") ?? "");
  const endDate = String(formData.get("end_date") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const blockType = String(formData.get("block_type") ?? "manual_hold");

  if (!productId || !startDate) {
    return { ok: false, message: "Product and start date are required." };
  }

  const resolvedEndDate = endDate || startDate;

  if (!hasSupabaseEnv()) {
    return { ok: true, message: `Demo mode: Would block ${startDate} to ${resolvedEndDate}.` };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  try {
    const userLimit = await enforceRateLimit({
      scope: "availability:block:user",
      actor: ctx.userId,
      limit: 30,
      windowSeconds: 300,
    });
    if (!userLimit.allowed) {
      return { ok: false, message: "Too many requests. Please wait." };
    }
  } catch {
    return { ok: false, message: "Unable to process right now." };
  }

  const supabase = await createSupabaseServerClient();

  // Verify product belongs to org
  const { data: product } = await supabase
    .from("products")
    .select("id, name")
    .eq("id", productId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!product) {
    return { ok: false, message: "Product not found." };
  }

  const startWindow = getAvailabilityWindowForDate(startDate);
  const endWindow = getAvailabilityWindowForDate(resolvedEndDate);

  if (!startWindow || !endWindow) {
    return { ok: false, message: "Invalid date range." };
  }

  const { error } = await supabase.from("availability_blocks").insert({
    organization_id: ctx.organizationId,
    product_id: productId,
    block_type: blockType,
    starts_at: startWindow.startsAt,
    ends_at: endWindow.endsAt,
    reason: reason || `Manual hold on ${product.name}`,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/calendar");
  revalidatePath(`/dashboard/products/${productId}`);

  return {
    ok: true,
    message: `${product.name} blocked from ${startDate} to ${resolvedEndDate}.`,
  };
}

/**
 * Remove a manual availability block.
 */
export async function removeAvailabilityBlock(
  blockId: string
): Promise<AvailabilityActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Block would be removed." };
  }

  const ctx = await getOrgContext();
  if (!ctx) {
    return { ok: false, message: "Not authenticated." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: block } = await supabase
    .from("availability_blocks")
    .select("id, block_type, source_order_id")
    .eq("id", blockId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!block) {
    return { ok: false, message: "Block not found." };
  }

  if (block.source_order_id && block.block_type === "order_hold") {
    return { ok: false, message: "Cannot remove an order-linked reservation. Cancel the order instead." };
  }

  const { error } = await supabase
    .from("availability_blocks")
    .delete()
    .eq("id", blockId)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/dashboard/calendar");
  return { ok: true, message: "Availability block removed." };
}

/**
 * Release all availability blocks for a cancelled order.
 * Called from updateOrderStatus when order → cancelled.
 */
export async function releaseOrderAvailability(
  organizationId: string,
  orderId: string
): Promise<void> {
  if (!hasSupabaseEnv()) return;

  const supabase = await createSupabaseServerClient();

  await supabase
    .from("availability_blocks")
    .delete()
    .eq("organization_id", organizationId)
    .eq("source_order_id", orderId);
}
