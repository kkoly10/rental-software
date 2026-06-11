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
import { computeTaxCents } from "@/lib/market/tax";
import { resolveOperatingDefaults } from "@/lib/market/registry";
import { marketWallClock } from "@/lib/market/time";
import { redirect } from "next/navigation";

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

  // Bug #18: pin booking windows to the marketplace timezone (DMV),
  // not the server's (UTC on Vercel) — otherwise "tomorrow 9am" lands
  // on the wrong calendar day.
  const startsAt = marketWallClock(parsed.data.startDate, 9, 0);
  const endsAt = marketWallClock(parsed.data.endDate, 18, 0);
  const now = new Date();
  if (!(startsAt > now)) {
    return { ok: false, message: "Start date must be in the future." };
  }
  if (!(endsAt > startsAt)) {
    return { ok: false, message: "End date must be after the start date." };
  }
  // Bug #28: rental days come from the calendar dates, not the synthetic
  // 09:00/18:00 timestamps (which would diverge from the blocked window).
  const startMs = Date.parse(`${parsed.data.startDate}T00:00:00Z`);
  const endMs = Date.parse(`${parsed.data.endDate}T00:00:00Z`);
  const rentalDays = Math.max(1, Math.round((endMs - startMs) / 86_400_000) || 1);
  if (rentalDays > MAX_RENTAL_DAYS) {
    return { ok: false, message: `Rentals are capped at ${MAX_RENTAL_DAYS} days for now.` };
  }

  // Published, bookable listing (anon-readable, so the user client works).
  const { data: listing } = await supabase
    .from("market_listings")
    .select(
      "id, organization_id, world_slug, category_slug, status, is_prelist, daily_price_cents, weekend_price_cents, weekly_price_cents, deposit_cents, quantity, prep_buffer_minutes, recovery_buffer_minutes, instant_book",
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
  // §12 gate (roadmap item 1): never take a booking for a seller who
  // can't be paid. Read at decision time so a Stripe restriction
  // auto-pauses bookability.
  {
    const { sellerBookable } = await import("@/lib/market/bookability");
    if (!(await sellerBookable(listing.organization_id))) {
      return {
        ok: false,
        message:
          "This seller is finishing payout verification — booking opens once it's done. Message them in the meantime.",
      };
    }
  }
  if (parsed.data.quantity > listing.quantity) {
    return { ok: false, message: `Only ${listing.quantity} available.` };
  }

  // Bug #24: renters can't book ANY listing from an org they belong
  // to — check every membership, not just the active org context.
  {
    const { data: memberOrgs } = await supabase.rpc("get_user_org_ids");
    const orgIds = (memberOrgs as { get_user_org_ids: string }[] | string[] | null) ?? [];
    const ids = Array.isArray(orgIds)
      ? orgIds.map((o) => (typeof o === "string" ? o : o.get_user_org_ids))
      : [];
    if (ids.includes(listing.organization_id)) {
      return { ok: false, message: "You can't book your own listing." };
    }
  }
  const ctx = await getOrgContext();

  const defaults = resolveOperatingDefaults(listing.world_slug, listing.category_slug);

  // Trust gates (founder decision 2026-06-11, Turo-style): a verified
  // phone is required to book anything; full_id categories also need
  // the ID + live-selfie on file (stored privately, admin-viewed only
  // when a dispute arises).
  const { getVerificationStatus } = await import("@/lib/market/verification-actions");
  const verification = await getVerificationStatus(user.id);
  if (!verification.phoneVerified) {
    return { ok: false, message: "Verify your phone number first — it takes 30 seconds on the Verify page (/market/verify)." };
  }
  // Turo model (founder decision): ID + live selfie are required for
  // EVERY rental — the seller confirms the match at handoff before the
  // item leaves their hands.
  if (!verification.idOnFile) {
    return { ok: false, message: "Add your ID + live selfie on the Verify page (/market/verify) — sellers confirm it's you at pickup, on every rental." };
  }

  // Honor advertised weekend/weekly rates (Codex review, PR #381) —
  // renter-favoring rate selection, never above daily × days.
  const { computeRentalSubtotalCents } = await import("@/lib/market/pricing");
  const subtotal = computeRentalSubtotalCents({
    rentalDays,
    quantity: parsed.data.quantity,
    dailyCents: listing.daily_price_cents,
    weekendCents: listing.weekend_price_cents,
    weeklyCents: listing.weekly_price_cents,
    startsAt: new Date(startMs),
  });
  if (subtotal < defaults.minBookingSubtotalCents) {
    return {
      ok: false,
      message: `Minimum booking for this category is $${(defaults.minBookingSubtotalCents / 100).toFixed(0)}.`,
    };
  }

  const admin = await getAdminClient();

  // Seller kind decides the fee tier (§23): marketplace-only sellers
  // pay 15%, Korent operators 8%. Facilitator tax keys off the
  // seller's state (lib/market/tax.ts — DC/MD/VA all tax rentals).
  const [{ data: sellerOrg }, { data: sellerProfile }] = await Promise.all([
    admin.from("organizations").select("business_type").eq("id", listing.organization_id).maybeSingle(),
    admin
      .from("market_seller_profiles")
      .select("state_code")
      .eq("organization_id", listing.organization_id)
      .maybeSingle(),
  ]);
  const sellerKind =
    sellerOrg?.business_type === "marketplace_seller" ? "marketplace" : "korent_operator";
  const taxState = sellerProfile?.state_code ?? "DC";
  const fee = computePlatformFeeCents(subtotal, sellerKind);
  const payout = computeSellerPayoutCents(subtotal, sellerKind);
  const tax = computeTaxCents(subtotal, taxState);
  // §10 instant book: category allows it AND the seller opted in.
  // The renter is live in checkout, so a 30-minute checkout_hold is
  // taken atomically BEFORE the booking row exists; payment follows
  // immediately and the webhook confirms.
  const instant = Boolean(listing.instant_book) && defaults.instantBookAllowed;
  let instantHoldId: string | null = null;
  if (instant) {
    const { data: holdResult } = await admin.rpc("market_reserve_hold", {
      p_listing_id: listing.id,
      p_renter_profile_id: user.id,
      p_starts_at: startsAt.toISOString(),
      p_ends_at: endsAt.toISOString(),
      p_quantity: parsed.data.quantity,
      // Bug #27: the hold backs a real awaiting_payment booking, so it
      // gets the 24h payment TTL (matching the "pay from My rentals"
      // copy), not the 30-min checkout TTL that would silently kill it.
      p_state: "awaiting_renter_payment",
      p_ttl_minutes: 24 * 60,
    });
    const hr = holdResult as { ok?: boolean; hold_id?: string } | null;
    if (!hr?.ok || !hr.hold_id) {
      return { ok: false, message: "Those dates just became unavailable — try different dates." };
    }
    instantHoldId = hr.hold_id;
  }

  // Bug #20: if anything below fails, the instant hold must be released
  // so it doesn't block the slot for its whole TTL.
  const releaseInstantHold = async () => {
    if (instantHoldId) {
      await admin
        .from("market_reservation_holds")
        .update({ state: "released", updated_at: new Date().toISOString() })
        .eq("id", instantHoldId);
    }
  };

  const { data: booking, error } = await admin
    .from("market_bookings")
    .insert({
      listing_id: listing.id,
      organization_id: listing.organization_id,
      renter_profile_id: user.id,
      state: instant ? "awaiting_payment" : "pending_seller_approval",
      hold_id: instantHoldId,
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
      tax_cents: tax,
      tax_state_code: taxState,
      deposit_cents: listing.deposit_cents,
      deposit_strategy: defaults.depositStrategy,
      renter_message: parsed.data.message || null,
    })
    .select("id")
    .single();

  if (error || !booking) {
    await releaseInstantHold();
    return { ok: false, message: "Couldn't create the request — please try again." };
  }
  await logBookingEvent(admin, booking.id, instant ? "booking.instant" : "booking.requested", "renter", {
    rental_days: rentalDays,
    subtotal_cents: subtotal,
  });

  revalidatePath(SELLER_HUB_PATH);

  if (!instant) {
    const { getBookingPartyEmails, notifyMarketEmail } = await import("@/lib/market/notify");
    const party = await getBookingPartyEmails(booking.id);
    if (party) {
      void notifyMarketEmail({
        kind: "request_received",
        to: party.sellerEmail,
        listingTitle: party.listingTitle,
        startsAt: party.startsAt,
        endsAt: party.endsAt,
      });
    }
  }

  if (instant) {
    const { createCheckoutUrlForBooking } = await import("@/lib/market/payment-actions");
    const url = await createCheckoutUrlForBooking(booking.id, user.id);
    if (url) redirect(url); // NEXT_REDIRECT propagates out of the action
    // Booking exists in awaiting_payment with the 24h hold — the renter
    // finishes from My Rentals; the cron cancels + releases if they don't.
    return {
      ok: true,
      message: "Booked — finish payment from My rentals (the seller's payout setup is still syncing).",
    };
  }

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
    // Dates were taken by a competing booking: auto-cancel honestly
    // instead of leaving a zombie request the seller keeps accepting
    // (gap analysis #5) and tell the renter why.
    await admin
      .from("market_bookings")
      .update({
        state: "cancelled",
        cancelled_by: "system",
        cancel_reason: "dates_unavailable_at_approval",
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.id)
      .eq("state", from);
    await logBookingEvent(admin, booking.id, "booking.approval_failed", "system", {
      reason: result?.reason ?? holdError?.message ?? "unknown",
    });
    const { getBookingPartyEmails, notifyMarketEmail } = await import("@/lib/market/notify");
    const party = await getBookingPartyEmails(booking.id);
    if (party) {
      void notifyMarketEmail({
        kind: "request_unavailable",
        to: party.renterEmail,
        listingTitle: party.listingTitle,
        startsAt: party.startsAt,
        endsAt: party.endsAt,
      });
    }
    revalidatePath(SELLER_HUB_PATH);
    return;
  }

  assertTransition(from, "awaiting_payment");
  // Bug #22: guard on affected-row count. Bug #21: if a concurrent
  // action already moved the booking, the update no-ops — release the
  // hold we just created so it doesn't block the slot for 24h.
  const { data: approved } = await admin
    .from("market_bookings")
    .update({
      state: "awaiting_payment",
      hold_id: result.hold_id,
      seller_responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("state", from)
    .select("id")
    .maybeSingle();
  if (!approved) {
    await admin
      .from("market_reservation_holds")
      .update({ state: "released", updated_at: new Date().toISOString() })
      .eq("id", result.hold_id);
    revalidatePath(SELLER_HUB_PATH);
    return;
  }
  await logBookingEvent(admin, booking.id, "booking.approved", "seller");
  {
    const { getBookingPartyEmails, notifyMarketEmail } = await import("@/lib/market/notify");
    const party = await getBookingPartyEmails(booking.id);
    if (party) {
      void notifyMarketEmail({
        kind: "request_approved",
        to: party.renterEmail,
        listingTitle: party.listingTitle,
        startsAt: party.startsAt,
        endsAt: party.endsAt,
      });
    }
  }
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

  // Bug #22: bail if the guarded update changed no row (race).
  const { data: declined } = await admin
    .from("market_bookings")
    .update({
      state: "cancelled",
      cancelled_by: "seller",
      cancel_reason: "seller_declined",
      seller_responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id)
    .eq("state", from)
    .select("id")
    .maybeSingle();
  if (!declined) {
    revalidatePath(SELLER_HUB_PATH);
    return;
  }
  await logBookingEvent(admin, booking.id, "booking.declined", "seller");
  {
    const { getBookingPartyEmails, notifyMarketEmail } = await import("@/lib/market/notify");
    const party = await getBookingPartyEmails(booking.id);
    if (party) {
      void notifyMarketEmail({
        kind: "request_declined",
        to: party.renterEmail,
        listingTitle: party.listingTitle,
        startsAt: party.startsAt,
        endsAt: party.endsAt,
      });
    }
  }
  revalidatePath(SELLER_HUB_PATH);
}

// Renter/seller cancellation, refunds and no-shows live in
// lib/market/cancel-actions.ts (policy engine: lib/market/cancellation.ts).
