import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  createSupabaseAdminClient,
  hasSupabaseServiceRoleEnv,
} from "@/lib/supabase/admin";

export const maxDuration = 60;

/**
 * Cron job: Clean up expired availability holds from abandoned checkouts.
 *
 * Runs every 15 minutes via Vercel cron. Deletes availability_blocks where
 * expires_at is in the past, releasing inventory that customers never paid for.
 *
 * Also cancels the associated orders that were never paid (still "awaiting_deposit")
 * so operators aren't confused by ghost orders.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret — fail closed: if CRON_SECRET is not configured the
  // route must not be publicly callable.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();

  // Find expired holds for orders that are still awaiting payment.
  // Blocks whose orders have already advanced (e.g. manually confirmed by the operator)
  // are intentionally excluded — only the webhook/payment action should promote those.
  const { data: expiredBlocks, error: fetchError } = await admin
    .from("availability_blocks")
    .select("id, source_order_id, organization_id, orders!inner(order_status)")
    .eq("block_type", "checkout_hold")
    .lt("expires_at", now)
    .eq("orders.order_status", "awaiting_deposit");

  if (fetchError) {
    console.error("Failed to fetch expired holds:", fetchError.message);
    return NextResponse.json(
      { error: "Failed to fetch expired holds" },
      { status: 500 }
    );
  }

  if (!expiredBlocks || expiredBlocks.length === 0) {
    return NextResponse.json({ released: 0 });
  }

  const blockIds = expiredBlocks.map((b) => b.id);
  const orderIds = [
    ...new Set(
      expiredBlocks.map((b) => b.source_order_id).filter(Boolean) as string[]
    ),
  ];

  // Cancel orders FIRST so we never leave a cancelled order without an available hold.
  // If the cancellation fails, abort — do NOT delete blocks and leave orders stuck.
  if (orderIds.length > 0) {
    const { error: cancelError } = await admin
      .from("orders")
      .update({ order_status: "cancelled" })
      .in("id", orderIds)
      .eq("order_status", "awaiting_deposit");

    if (cancelError) {
      console.error("Failed to cancel expired orders:", cancelError.message);
      return NextResponse.json(
        { error: "Failed to cancel expired orders; blocks not deleted to prevent data loss" },
        { status: 500 }
      );
    }
  }

  // Then release the availability blocks
  const { error: deleteError } = await admin
    .from("availability_blocks")
    .delete()
    .in("id", blockIds);

  if (deleteError) {
    console.error("Failed to delete expired holds:", deleteError.message);
    // Orders were already cancelled — return 500 so the caller knows the
    // blocks were NOT cleaned up, even though some orders are now cancelled.
    return NextResponse.json(
      { error: "Orders cancelled but blocks delete failed; blocks may be orphaned" },
      { status: 500 }
    );
  }

  // #344 Tell the customer their pending booking has been released, so
  // they're not waiting indefinitely after their payment session timed out.
  // Each call is wrapped — one failed email must not stop the others.
  if (orderIds.length > 0) {
    const { triggerOrderStatusEmail } = await import("@/lib/email/triggers");
    const orgByOrder = new Map<string, string>();
    for (const b of expiredBlocks) {
      if (b.source_order_id && b.organization_id) {
        orgByOrder.set(b.source_order_id, b.organization_id);
      }
    }
    await Promise.allSettled(
      Array.from(orgByOrder.entries()).map(([orderId, organizationId]) =>
        triggerOrderStatusEmail({
          organizationId,
          orderId,
          newStatus: "cancelled",
        }).catch((err) =>
          console.error("[cleanup-holds] status email failed", orderId, err instanceof Error ? err.message : err)
        )
      )
    );
  }

  // #344 Dashboard counts and storefront availability both need to refresh
  // when the cron releases holds; otherwise operators see ghost orders and
  // customers see false sold-out badges.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/orders");
  revalidatePath("/inventory", "layout");
  revalidatePath("/order-status");

  console.log(
    `Cleanup: released ${blockIds.length} expired holds, cancelled ${orderIds.length} orders`
  );

  return NextResponse.json({
    released: blockIds.length,
    ordersCancelled: orderIds.length,
  });
}
