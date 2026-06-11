import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Multi-item booking helpers (roadmap item 5, master plan §13).
 * A booking's inventory is the PRIMARY listing (bookings.listing_id /
 * hold_id — legacy shape) plus zero or more market_booking_items rows
 * with their own holds. Every hold mutation must cover the full set
 * or secondary items leak/strand inventory.
 */

export type BookingItemRow = {
  id: string;
  listing_id: string;
  hold_id: string | null;
  quantity: number;
  daily_price_cents: number;
  subtotal_cents: number;
  title_snapshot: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = SupabaseClient<any, any, any>;

export async function getBookingItems(
  admin: Admin,
  bookingId: string,
): Promise<BookingItemRow[]> {
  const { data } = await admin
    .from("market_booking_items")
    .select("id, listing_id, hold_id, quantity, daily_price_cents, subtotal_cents, title_snapshot")
    .eq("booking_id", bookingId)
    .order("created_at");
  return (data as BookingItemRow[] | null) ?? [];
}

/** All hold ids backing a booking: primary + per-item. */
export async function bookingHoldIds(
  admin: Admin,
  bookingId: string,
  primaryHoldId: string | null,
): Promise<string[]> {
  const items = await getBookingItems(admin, bookingId);
  const ids = new Set<string>();
  if (primaryHoldId) ids.add(primaryHoldId);
  for (const i of items) if (i.hold_id) ids.add(i.hold_id);
  return [...ids];
}

/** Apply one state patch to every hold backing the booking. */
export async function updateBookingHolds(
  admin: Admin,
  bookingId: string,
  primaryHoldId: string | null,
  patch: Record<string, unknown>,
): Promise<void> {
  const ids = await bookingHoldIds(admin, bookingId, primaryHoldId);
  if (ids.length === 0) return;
  await admin
    .from("market_reservation_holds")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .in("id", ids);
}
