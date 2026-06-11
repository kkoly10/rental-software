import { hasSupabaseEnv } from "@/lib/env";

/**
 * §27 bridge emit — marketplace side. Fire-and-forget: an outbox
 * write failure must never break the commercial lifecycle; the event
 * log + cron reconciliation are the safety net.
 */
export type BridgeEvent =
  | "marketplace.booking.confirmed"
  | "marketplace.booking.cancelled"
  | "marketplace.booking.completed";

export async function emitBridgeEvent(input: {
  event: BridgeEvent;
  bookingId: string;
  organizationId: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    if (!hasSupabaseEnv()) return;
    const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
    const admin = createSupabaseAdminClient();
    await admin.from("market_bridge_outbox").insert({
      event: input.event,
      booking_id: input.bookingId,
      organization_id: input.organizationId,
      payload: input.payload ?? null,
    });
  } catch {
    // best-effort by design
  }
}
