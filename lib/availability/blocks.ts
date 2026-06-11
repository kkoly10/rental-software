import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAvailabilityWindowForDate } from "@/lib/availability/window";

/**
 * Reserve availability for a checkout order.
 *
 * For website checkouts (source = "checkout"), a temporary hold is created
 * with a 30-minute expiration. The hold is converted to permanent when the
 * Stripe webhook confirms payment. If the customer abandons checkout, the
 * cron job (/api/cron/cleanup-holds) releases the expired hold.
 *
 * For dashboard-created orders, the hold is permanent immediately (no expiration).
 */
export async function reserveProductAvailabilityBlock(options: {
  organizationId: string;
  productId: string;
  orderId: string;
  eventDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  rentalEndDate?: string | null;
  source?: "checkout" | "dashboard";
}) {
  const isCheckout = options.source === "checkout";
  const supabase = await createSupabaseServerClient();

  // PR-1 #3 — match the check path: the reserved block must extend
  // by the product's setup/breakdown minutes so a future check on
  // an overlapping window correctly rejects.
  const { data: productMeta } = await supabase
    .from("products")
    .select("setup_minutes_before, breakdown_minutes_after")
    .eq("id", options.productId)
    .eq("organization_id", options.organizationId)
    .maybeSingle();

  const window = getAvailabilityWindowForDate(
    options.eventDate,
    options.startTime,
    options.endTime,
    options.rentalEndDate,
    productMeta?.setup_minutes_before ?? 0,
    productMeta?.breakdown_minutes_after ?? 0
  );
  if (!window) {
    return { ok: true } as const;
  }

  // Checkout holds expire after 30 minutes; dashboard holds are permanent
  const expiresAt = isCheckout
    ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
    : null;

  // Atomic check-and-insert via DB function: advisory lock on (org, product)
  // eliminates the TOCTOU race between the JS-level availability check and
  // the actual block insert.
  const { data, error } = await supabase.rpc("reserve_availability_if_available", {
    p_organization_id: options.organizationId,
    p_product_id: options.productId,
    p_block_type: isCheckout ? "checkout_hold" : "order_hold",
    p_starts_at: window.startsAt,
    p_ends_at: window.endsAt,
    p_reason: isCheckout ? "Temporary hold during checkout" : "Reserved through dashboard",
    p_source_order_id: options.orderId,
    p_expires_at: expiresAt,
  });

  if (error) {
    return { ok: false, message: error.message } as const;
  }

  const result = data as { ok: boolean; reason?: string; block_id?: string };
  if (!result.ok) {
    return { ok: false, message: result.reason ?? "Unable to reserve availability." } as const;
  }

  return { ok: true, blockId: result.block_id ?? null } as const;
}

/**
 * Decision 2.7 / follow-up #2: after the order is INSERTed (so its row
 * exists in `orders`), attach its id to the reserved availability block
 * so the cleanup-on-cancel logic + analytics can join the two. Called by
 * the checkout flow once the order row is in.
 *
 * Idempotent: safe to call again if the order id was already set.
 */
export async function attachOrderIdToAvailabilityBlock(blockId: string, orderId: string) {
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("availability_blocks")
    .update({ source_order_id: orderId })
    .eq("id", blockId)
    .is("source_order_id", null);
}

/**
 * Post-launch follow-up #3: createOrder reserves availability when the
 * order is created in a should-reserve status, but updateOrderStatus
 * did not — so an inquiry created without an event_date, then later
 * given a date and Mark Confirmed-d via the order detail page, would
 * flip to "confirmed" with NO availability block. The same product
 * could then be confirmed for the same date by a second order.
 *
 * This helper closes that path. Called from updateOrderStatus when the
 * transition is into a should-reserve status. Idempotent: skips when
 * a block already exists for the order, or when there's no
 * product/event_date to reserve against.
 */
export async function ensureAvailabilityForOrder(
  organizationId: string,
  orderId: string
): Promise<{
  ok: boolean;
  reason: "no_data" | "already_reserved" | "reserved" | "failed";
  message?: string;
}> {
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("availability_blocks")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("source_order_id", orderId)
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: true, reason: "already_reserved" };

  const { data: order } = await supabase
    .from("orders")
    .select("id, event_date, start_time, end_time, rental_end_date")
    .eq("id", orderId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!order?.event_date) return { ok: true, reason: "no_data" };

  const { data: items } = await supabase
    .from("order_items")
    .select("product_id, line_type")
    .eq("order_id", orderId)
    .eq("line_type", "rental")
    .limit(1);
  const productId = items?.[0]?.product_id ?? null;
  if (!productId) return { ok: true, reason: "no_data" };

  const reserveResult = await reserveProductAvailabilityBlock({
    organizationId,
    productId,
    orderId,
    eventDate: order.event_date,
    startTime: order.start_time,
    endTime: order.end_time,
    rentalEndDate: order.rental_end_date,
    source: "dashboard",
  });
  if (!reserveResult.ok) {
    return { ok: false, reason: "failed", message: reserveResult.message };
  }
  return { ok: true, reason: "reserved" };
}
