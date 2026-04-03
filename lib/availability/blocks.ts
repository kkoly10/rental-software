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
  source?: "checkout" | "dashboard";
}) {
  const window = getAvailabilityWindowForDate(options.eventDate, options.startTime, options.endTime);
  if (!window) {
    return { ok: true } as const;
  }

  const isCheckout = options.source === "checkout";
  const supabase = await createSupabaseServerClient();

  // Checkout holds expire after 30 minutes; dashboard holds are permanent
  const expiresAt = isCheckout
    ? new Date(Date.now() + 30 * 60 * 1000).toISOString()
    : null;

  const { error } = await supabase.from("availability_blocks").insert({
    organization_id: options.organizationId,
    product_id: options.productId,
    block_type: isCheckout ? "checkout_hold" : "order_hold",
    starts_at: window.startsAt,
    ends_at: window.endsAt,
    reason: isCheckout ? "Temporary hold during checkout" : "Reserved through dashboard",
    source_order_id: options.orderId,
    expires_at: expiresAt,
  });

  if (error) {
    return {
      ok: false,
      message: error.message,
    } as const;
  }

  return { ok: true } as const;
}
