"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  assertTransition,
  canTransition,
  type BookingState,
} from "@/lib/market/booking-state";
import { computePlatformFeeCents, computeSellerPayoutCents } from "@/lib/market/fees";
import { resolveOperatingDefaults } from "@/lib/market/registry";

/**
 * Booking lifecycle actions (spec §10/§13, build plan M2).
 *
 * Writes go through the admin client (booking tables are RPC/service-
 * role-only, mirroring the payments posture); every state change is
 * guarded by the pure state machine and logged to
 * market_booking_events.
 *
 * §10 encoded here:
 *  - a request does NOT hold inventory; the hold is taken atomically
 *    at APPROVAL via market_reserve_hold (state 'confirmed', no TTL)
 *  - the renter's payment method capture lands in M3 (Stripe Connect
 *    destination charge); approval currently records the money
 *    snapshot and the §13 transition only.
 *
 * Launch fee note: every launch seller is a Korent operator (the
 * Seller Hub requires an org), so the 8% operator fee applies.
 * Marketplace-only sellers (12%) arrive with their own signup flow.
 */

export type BookingActionState = { ok: boolean; message: string };

const MAX_RENTAL_DAYS = 30;
const SELLER_HUB_PATH = "/dashboard/marketplace";

async function rateLimited(scope: string): Promise<boolean> {
  try {
    const key = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope,
      actor: key,
      limit: 20,
      windowSeconds: 300,
      strict: true,
    });
    return !limit.allowed;
  } catch {
    return true;
  }
}

async function getAdminClient() {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  return createSupabaseAdminClient();
}

async function logBookingEvent(
  admin: Awaited<ReturnType<typeof getAdminClient>>,
  bookingId: string,
  event: string,
  actor: "renter" | "seller" | "system",
  payload?: Record<string, unknown>,
) {
  await admin.from("market_booking_events").insert({
    booking_id: bookingId,
    event,
    actor,
    payload: payload ?? null,
  });
}

// ── Renter: request to book ──────────────────────────────────────────

const requestSchema = z.object({
  listingId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.coerce.number().int().min(1).max(10_000).default(1),
  message: z.string().max(1000).optional().or(z.literal("")),
});

export async function requestBooking(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Booking is unavailable in this environment." };
  }

  const parsed = requestSchema.safeParse({
    listingId: formData.get("listing_id"),
    startDate: formData.get("start_date"),
    endDate: formData.get("end_date"),
    quantity: formData.get("quantity") || 1,
    message: formData.get("message") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid request." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Sign in to request a booking." };
  }

  if (await rateLimited("market:booking-request")) {
    return { ok: false, message: "Too many requests — try again in a few minutes." };
  }

  const startsAt = new Date(`${parsed.data.startDate}T09:00:00`);
  const endsAt = new Date(`${parsed.data.endDate}T18:00:00`);
  const now = new Date();
  if (!(startsAt > now)) {
    return { ok: false, message: "Start date must be in the future." };
  }
  if (!(endsAt > startsAt)) {
    return { ok: false, message: "End date must be after the start date." };
  }
  const rentalDays = Math.max(
    1,
    Math.ceil((endsAt.getTime() - startsAt.getTime()) / 86_400_000),
  );
  if (rentalDays > MAX_RENTAL_DAYS) {
    return { ok: false, message: `Rentals are capped at ${MAX_RENTAL_DAYS} days for now.` };
  }

  // Published, bookable listing (anon-readable, so the user client works).
  const { data: listing } = await supabase
    .from("market_listings")
    .select(
      "id, organization_id, world_slug, category_slug, status, is_prelist, daily_price_cents, deposit_cents, quantity, prep_buffer_minutes, recovery_buffer_minutes",
    )
    .eq("id", parsed.data.listingId)
    .eq("status", "published")
    .maybeSingle();

  if (!listing) return { ok: false, message: "This listing is no longer available." };
  if (listing.is_prelist) {
    return { ok: false, message: "This world isn't bookable yet — join the waitlist instead." };
  }
  if (listing.organization_id == null) {
    return { ok: false, message: "This listing is misconfigured." };
  }
  if (parsed.data.quantity > listing.quantity) {
    return { ok: false, message: `Only ${listing.quantity} available.` };
  }

  // Renters can't book their own org's listings.
  const ctx = await getOrgContext();
  if (ctx && ctx.organizationId === listing.organization_id) {
    return { ok: false, message: "You can't book your own listing." };
  }

  const defaults = resolveOperatingDefaults(listing.world_slug, listing.category_slug);
  const subtotal = listing.daily_price_cents * rentalDays * parsed.data.quantity;
  if (subtotal < defaults.minBookingSubtotalCents) {
    return {
      ok: false,
      message: `Minimum booking for this category is $${(defaults.minBookingSubtotalCents / 100).toFixed(0)}.`,
    };
  }
  const fee = computePlatformFeeCents(subtotal, "korent_operator");
  const payout = computeSellerPayoutCents(subtotal, "korent_operator");

  const admin = await getAdminClient();
  const { data: booking, error } = await admin
    .from("market_bookings")
    .insert({
      listing_id: listing.id,
      organization_id: listing.organization_id,
      renter_profile_id: user.id,
      state: "pending_seller_approval",
      quantity: parsed.data.quantity,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      prep_buffer_minutes: listing.prep_buffer_minutes,
      recovery_buffer_minutes: listing.recovery_buffer_minutes,
      rental_days: rentalDays,
      daily_price_cents: listing.daily_price_cents,
      subtotal_cents: subtotal,
      platform_fee_cents: fee,
      seller_payout_cents: payout,
      deposit_cents: listing.deposit_cents,
      deposit_strategy: defaults.depositStrategy,
      renter_message: parsed.data.message || null,
    })
    .select("id")
    .single();

  if (error || !booking) {
    return { ok: false, message: "Couldn't create the request — please try again." };
  }
  await logBookingEvent(admin, booking.id, "booking.requested", "renter", {
    rental_days: rentalDays,
    subtotal_cents: subtotal,
  });

  revalidatePath(SELLER_HUB_PATH);
  return {
    ok: true,
    message:
      "Request sent. The seller has 24 hours to respond — you pay nothing unless they accept.",
  };
}

// ── Seller: approve / decline ────────────────────────────────────────

async function requireSellerBooking(bookingId: string) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const admin = await getAdminClient();
  const { data: booking } = await admin
    .from("market_bookings")
    .select(
      "id, listing_id, organization_id, state, quantity, starts_at, ends_at, renter_profile_id",
    )
    .eq("id", bookingId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  return booking ? { booking, admin } : null;
}

export async function approveBookingRequest(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!z.string().uuid().safeParse(bookingId).success) return;
  if (await rateLimited("market:booking-decide")) return;

  const found = await requireSellerBooking(bookingId);
  if (!found) return;
  const { booking, admin } = found;

  const from = booking.state as BookingState;
  if (!canTransition(from, "awaiting_payment")) return;

  // §10: the inventory hold is taken NOW, atomically, at approval —
  // held for 24h while the renter pays (awaiting_renter_payment TTL).
  // The 5-minute cron expires it (and the booking) if they never do.
  const { data: holdResult, error: holdError } = await admin.rpc("market_reserve_hold", {
    p_listing_id: booking.listing_id,
    p_renter_profile_id: booking.renter_profile_id,
    p_starts_at: booking.starts_at,
    p_ends_at: booking.ends_at,
    p_quantity: booking.quantity,
    p_state: "awaiting_renter_payment",
    p_ttl_minutes: 24 * 60,
  });

  const result = holdResult as { ok?: boolean; hold_id?: string; reason?: string } | null;
  if (holdError || !result?.ok || !result.hold_id) {
    await logBookingEvent(admin, booking.id, "booking.approval_failed", "system", {
      reason: result?.reason ?? holdError?.message ?? "unknown",
    });
    revalidatePath(SELLER_HUB_PATH);
    return;
  }

  assertTransition(from, "awaiting_payment");
  await admin
    .from("market_bookings")
    .update({
      state: "awaiting_payment",
      hold_id: result.hold_id,
      seller_responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("state", from);
  await logBookingEvent(admin, booking.id, "booking.approved", "seller");
  // The renter pays via /market/rentals (destination charge); the
  // marketplace webhook flips awaiting_payment → confirmed. Once
  // saved-payment-method vaulting exists, this becomes the §10
  // auto-capture and skips awaiting_payment for the common case.
  revalidatePath(SELLER_HUB_PATH);
}

export async function declineBookingRequest(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!z.string().uuid().safeParse(bookingId).success) return;
  if (await rateLimited("market:booking-decide")) return;

  const found = await requireSellerBooking(bookingId);
  if (!found) return;
  const { booking, admin } = found;

  const from = booking.state as BookingState;
  if (!canTransition(from, "cancelled")) return;

  await admin
    .from("market_bookings")
    .update({
      state: "cancelled",
      seller_responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("state", from);
  await logBookingEvent(admin, booking.id, "booking.declined", "seller");
  revalidatePath(SELLER_HUB_PATH);
}

// ── Renter: cancel a pending request ─────────────────────────────────

export async function cancelBookingRequest(formData: FormData): Promise<void> {
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!z.string().uuid().safeParse(bookingId).success) return;
  if (!hasSupabaseEnv()) return;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  if (await rateLimited("market:booking-cancel")) return;

  const admin = await getAdminClient();
  const { data: booking } = await admin
    .from("market_bookings")
    .select("id, state, hold_id, renter_profile_id")
    .eq("id", bookingId)
    .eq("renter_profile_id", user.id)
    .maybeSingle();
  if (!booking) return;

  const from = booking.state as BookingState;
  if (!canTransition(from, "cancelled")) return;

  await admin
    .from("market_bookings")
    .update({ state: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", booking.id)
    .eq("state", from);
  if (booking.hold_id) {
    await admin
      .from("market_reservation_holds")
      .update({ state: "released", updated_at: new Date().toISOString() })
      .eq("id", booking.hold_id);
  }
  await logBookingEvent(admin, booking.id, "booking.cancelled", "renter");
  revalidatePath("/market");
}
