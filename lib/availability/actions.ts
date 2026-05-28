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
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const blockType = String(formData.get("block_type") ?? "manual_hold");
  const ALLOWED_BLOCK_TYPES = ["manual_hold"];
  if (!ALLOWED_BLOCK_TYPES.includes(blockType)) {
    return { ok: false, message: "Invalid block type." };
  }

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

  const { data: blockMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(blockMembership?.role ?? "")) {
    return { ok: false, message: "Only dispatchers and above can manage availability." };
  }

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
    console.error("[availability] block insert failed:", error.message);
    return { ok: false, message: "Couldn't save the availability block." };
  }

  revalidatePath("/dashboard/calendar");
  revalidatePath(`/dashboard/products/${productId}`);
  // #367 storefront date picker reads the same blocks
  revalidatePath("/inventory");
  if (product) {
    const { data: prod } = await supabase
      .from("products")
      .select("slug")
      .eq("id", productId)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (prod?.slug) revalidatePath(`/inventory/${prod.slug}`);
  }

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

  const { data: removeMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(removeMembership?.role ?? "")) {
    return { ok: false, message: "Only dispatchers and above can manage availability." };
  }

  const { data: block } = await supabase
    .from("availability_blocks")
    .select("id, block_type, source_order_id, product_id")
    .eq("id", blockId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();

  if (!block) {
    return { ok: false, message: "Block not found." };
  }

  if (block.source_order_id && ["order_hold", "checkout_hold"].includes(block.block_type)) {
    return { ok: false, message: "Cannot remove an order-linked reservation. Cancel the order instead." };
  }

  const { error } = await supabase
    .from("availability_blocks")
    .delete()
    .eq("id", blockId)
    .eq("organization_id", ctx.organizationId);

  if (error) {
    console.error("[availability] block delete failed:", error.message);
    return { ok: false, message: "Couldn't remove the availability block." };
  }

  revalidatePath("/dashboard/calendar");
  revalidatePath("/inventory");
  if (block.product_id) {
    const { data: prod } = await supabase
      .from("products")
      .select("slug")
      .eq("id", block.product_id)
      .eq("organization_id", ctx.organizationId)
      .maybeSingle();
    if (prod?.slug) revalidatePath(`/inventory/${prod.slug}`);
  }
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

  const { error } = await supabase
    .from("availability_blocks")
    .delete()
    .eq("organization_id", organizationId)
    .eq("source_order_id", orderId);

  if (error) throw new Error(`Failed to release availability blocks: ${error.message}`);

  // #371 Without these, /inventory and /dashboard/calendar keep showing the
  // cancelled order's dates as reserved until the next ISR cycle.
  revalidatePath("/dashboard/calendar");
  revalidatePath("/inventory", "layout");
}
