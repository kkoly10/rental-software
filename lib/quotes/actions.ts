"use server";

import { revalidatePath } from "next/cache";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { blockDemoWrites } from "@/lib/demo/guard";

export type QuoteActionState = { ok: boolean; message: string };

export async function sendQuote(orderId: string): Promise<QuoteActionState> {
  if (!orderId) return { ok: false, message: "Invalid order." };

  if (!hasSupabaseEnv()) {
    return { ok: true, message: "Demo mode: Quote would be sent." };
  }

  const ctx = await getOrgContext();
  if (!ctx) return { ok: false, message: "Not authenticated." };

  const demoCheck = await blockDemoWrites(ctx.organizationId);
  if (demoCheck.blocked) return { ok: false, message: demoCheck.message };

  try {
    const limit = await enforceRateLimit({
      scope: "quotes:send:user",
      actor: ctx.userId,
      limit: 20,
      windowSeconds: 300,
    });
    if (!limit.allowed) {
      return { ok: false, message: "Too many quote sends. Please wait a moment." };
    }
  } catch {
    return { ok: false, message: "Unable to process right now." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: quoteMembership } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", ctx.organizationId)
    .eq("profile_id", ctx.userId)
    .eq("status", "active")
    .maybeSingle();
  if (!["owner", "admin", "dispatcher"].includes(quoteMembership?.role ?? "")) {
    return { ok: false, message: "You don't have permission to send quotes." };
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, order_status, customer_id, event_date")
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!order) return { ok: false, message: "Order not found." };

  if (!["inquiry", "quote_sent"].includes(order.order_status ?? "")) {
    return { ok: false, message: "Quote can only be sent for orders in Inquiry or Quote Sent status." };
  }

  const { error } = await supabase
    .from("orders")
    .update({ order_status: "quote_sent" })
    .eq("id", orderId)
    .eq("organization_id", ctx.organizationId)
    .is("deleted_at", null);

  if (error) return { ok: false, message: error.message };

  revalidatePath(`/dashboard/orders/${orderId}`);
  revalidatePath("/dashboard/orders");

  // Send quote email — awaited so it completes before the Lambda returns
  try {
    const { triggerQuoteSentEmail } = await import("@/lib/email/triggers");
    await triggerQuoteSentEmail({
      organizationId: ctx.organizationId,
      orderId,
      customerId: order.customer_id,
      orderNumber: order.order_number,
    });
  } catch {
    // Email failure is non-fatal — status is already updated
  }

  return { ok: true, message: "Quote sent to customer." };
}
