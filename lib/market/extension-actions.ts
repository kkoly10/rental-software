"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { getStripe, hasStripeEnv } from "@/lib/stripe/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { computeRentalSubtotalCents } from "@/lib/market/pricing";
import {
  computePlatformFeeCents,
  computeSellerPayoutCents,
} from "@/lib/market/fees";
import { computeTaxCents } from "@/lib/market/tax";

/**
 * Rental extensions (roadmap item 4, master plan §18/§19).
 * Research-locked rules:
 *  - charge at approval, off-session on the card saved at booking
 *    payment (Turo/Outdoorsy) — price previewed before submit
 *  - auto-approve only when the listing is instant-book AND no
 *    conflicting hold/booking overlaps the extension window plus the
 *    recovery buffer (Getaround)
 *  - otherwise a 12h seller window; lapse = original terms stand
 *  - a pending request suppresses late-fee accrual (deposit-holds
 *    cron checks); approval retroactively un-lates an overdue booking
 *  - cap 30 days per extension
 */

export type ExtensionState = { ok: boolean; message: string };

const DAY_MS = 86_400_000;
const APPROVAL_WINDOW_MS = 12 * 3600_000;

const requestSchema = z.object({
  bookingId: z.string().uuid(),
  newEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function rateLimited(scope: string): Promise<boolean> {
  try {
    const key = await getActionClientKey();
    const r = await enforceRateLimit({ scope, actor: key, limit: 10, windowSeconds: 300, strict: true });
    return !r.allowed;
  } catch {
    return true;
  }
}

type BookingRow = {
  id: string;
  state: string;
  starts_at: string;
  ends_at: string;
  quantity: number;
  rental_days: number;
  daily_price_cents: number;
  subtotal_cents: number;
  tax_cents: number;
  platform_fee_cents: number;
  seller_payout_cents: number;
  late_days_charged: number;
  recovery_buffer_minutes: number;
  listing_id: string;
  organization_id: string;
  renter_profile_id: string;
  hold_id: string | null;
  stripe_customer_id: string | null;
  stripe_payment_method_id: string | null;
};

const BOOKING_SELECT =
  "id, state, starts_at, ends_at, quantity, rental_days, daily_price_cents, subtotal_cents, tax_cents, platform_fee_cents, seller_payout_cents, late_days_charged, recovery_buffer_minutes, listing_id, organization_id, renter_profile_id, hold_id, stripe_customer_id, stripe_payment_method_id";

/** Any OTHER blocking booking or active hold overlapping the
 *  extension window (old end → new end + recovery buffer)?
 *  Small check-then-apply race accepted for v1 — the window between
 *  this query and the ends_at update is milliseconds, and a
 *  conflicting renter still goes through request→approval herself. */
async function extensionConflicts(
  admin: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  booking: BookingRow,
  newEndsAtIso: string,
): Promise<boolean> {
  const windowStart = booking.ends_at;
  const windowEnd = new Date(
    new Date(newEndsAtIso).getTime() + booking.recovery_buffer_minutes * 60_000,
  ).toISOString();

  const [{ data: holds }, { data: bookings }] = await Promise.all([
    admin
      .from("market_reservation_holds")
      .select("id, expires_at")
      .eq("listing_id", booking.listing_id)
      .in("state", ["checkout_hold", "verification_hold", "awaiting_renter_payment", "confirmed"])
      .lt("starts_at", windowEnd)
      .gt("ends_at", windowStart)
      .limit(5),
    admin
      .from("market_bookings")
      .select("id")
      .eq("listing_id", booking.listing_id)
      .neq("id", booking.id)
      .in("state", ["confirmed", "ready_for_handoff", "checked_out", "overdue"])
      .lt("starts_at", windowEnd)
      .gt("ends_at", windowStart)
      .limit(5),
  ]);

  const liveHolds = (holds ?? []).filter(
    (h) => !h.expires_at || new Date(h.expires_at).getTime() > Date.now(),
  );
  // The booking's own hold may overlap the window boundary — exclude it.
  const foreignHolds = liveHolds.filter((h) => h.id !== booking.hold_id);
  return foreignHolds.length > 0 || (bookings ?? []).length > 0;
}

/** Price the extension days at the booking's locked daily rate
 *  (weekly economics for the EXTENSION block ride the same helper). */
function priceExtension(booking: BookingRow, extensionDays: number, stateCode: string | null) {
  const subtotal = computeRentalSubtotalCents({
    rentalDays: extensionDays,
    quantity: booking.quantity,
    dailyCents: booking.daily_price_cents,
    startsAt: new Date(booking.ends_at),
  });
  const tax = computeTaxCents(subtotal, stateCode ?? "DC");
  const fee = computePlatformFeeCents(subtotal, "marketplace");
  const payout = computeSellerPayoutCents(subtotal, "marketplace");
  return { subtotal, tax, fee, payout };
}

/** Charge + apply: shared by seller approval and the auto-approve
 *  path. Off-session destination charge mirroring the original
 *  checkout split (fee + tax ride with the platform). */
async function chargeAndApply(
  admin: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  requestId: string,
  booking: BookingRow,
  ext: { requested_ends_at: string; extension_days: number; subtotal_cents: number; tax_cents: number; fee_cents: number; payout_cents: number },
  auto: boolean,
): Promise<ExtensionState> {
  if (!booking.stripe_customer_id || !booking.stripe_payment_method_id) {
    await admin
      .from("market_extension_requests")
      .update({ state: "failed", decided_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("state", "pending");
    return { ok: false, message: "No saved card on this booking — the renter must rebook the extra days." };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("stripe_connect_account_id")
    .eq("id", booking.organization_id)
    .maybeSingle();
  if (!org?.stripe_connect_account_id) {
    return { ok: false, message: "Seller payout account unavailable." };
  }

  const total = ext.subtotal_cents + ext.tax_cents;
  let paymentIntentId: string | null = null;
  try {
    const pi = await getStripe().paymentIntents.create(
      {
        amount: total,
        currency: "usd",
        customer: booking.stripe_customer_id,
        payment_method: booking.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        application_fee_amount: ext.fee_cents + ext.tax_cents,
        transfer_data: { destination: org.stripe_connect_account_id },
        description: `Rental extension (+${ext.extension_days} day${ext.extension_days === 1 ? "" : "s"})`,
        metadata: { surface: "marketplace", market_booking_id: booking.id, extension_request_id: requestId },
      },
      { idempotencyKey: `market_ext_${requestId}` },
    );
    paymentIntentId = pi.id;
  } catch {
    await admin
      .from("market_extension_requests")
      .update({ state: "failed", decided_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("state", "pending");
    return { ok: false, message: "The renter's card declined — extension not applied. They can retry with a new request." };
  }

  // Money moved — apply unconditionally (no CAS bail-outs after charge).
  await admin
    .from("market_extension_requests")
    .update({
      state: "approved",
      auto_approved: auto,
      stripe_payment_intent_id: paymentIntentId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  // Un-late if overdue (Turo: approval retroactively clears lateness);
  // already-charged late fees stand — accrual stops at the new end.
  await admin
    .from("market_bookings")
    .update({
      ends_at: ext.requested_ends_at,
      rental_days: booking.rental_days + ext.extension_days,
      subtotal_cents: booking.subtotal_cents + ext.subtotal_cents,
      tax_cents: booking.tax_cents + ext.tax_cents,
      platform_fee_cents: booking.platform_fee_cents + ext.fee_cents,
      seller_payout_cents: booking.seller_payout_cents + ext.payout_cents,
      ...(booking.state === "overdue" ? { state: "checked_out" } : {}),
      // Re-arm the time-based reminders for the new end date.
      return_reminder_sent_at: null,
      return_due_nudge_sent_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  // Stretch the inventory hold so the capacity math keeps blocking.
  if (booking.hold_id) {
    await admin
      .from("market_reservation_holds")
      .update({
        ends_at: new Date(
          new Date(ext.requested_ends_at).getTime() + booking.recovery_buffer_minutes * 60_000,
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", booking.hold_id);
  }

  await admin.from("market_booking_events").insert({
    booking_id: booking.id,
    event: auto ? "extension.auto_approved" : "extension.approved",
    actor: auto ? "system" : "seller",
    payload: { request_id: requestId, days: ext.extension_days, total_cents: total },
  });

  try {
    const { getBookingPartyEmails, notifyMarketEmail } = await import("@/lib/market/notify");
    const party = await getBookingPartyEmails(booking.id);
    if (party?.renterEmail) {
      void notifyMarketEmail({
        kind: "extension_approved",
        to: party.renterEmail,
        listingTitle: party.listingTitle,
        startsAt: party.startsAt,
        endsAt: ext.requested_ends_at,
        extra: `$${(total / 100).toFixed(2)} was charged to your saved card.`,
      });
    }
  } catch {
    // fire-and-forget
  }

  revalidatePath("/market/rentals");
  revalidatePath("/dashboard/marketplace");
  revalidatePath("/market/hub");
  return { ok: true, message: auto ? "Extension confirmed — your card was charged and the return date moved." : "Extension approved — the renter's card was charged." };
}

export async function requestExtension(
  _prev: ExtensionState,
  formData: FormData,
): Promise<ExtensionState> {
  if (!hasSupabaseEnv() || !hasStripeEnv()) {
    return { ok: false, message: "Extensions are unavailable in this environment." };
  }
  const parsed = requestSchema.safeParse({
    bookingId: formData.get("booking_id"),
    newEndDate: formData.get("new_end_date"),
  });
  if (!parsed.success) return { ok: false, message: "Pick a valid new return date." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };
  if (await rateLimited("market:extension-request")) {
    return { ok: false, message: "Too many requests — try again shortly." };
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { data: booking } = await admin
    .from("market_bookings")
    .select(BOOKING_SELECT)
    .eq("id", parsed.data.bookingId)
    .maybeSingle();
  if (!booking || booking.renter_profile_id !== user.id) {
    return { ok: false, message: "Booking not found." };
  }
  if (!["checked_out", "overdue"].includes(booking.state)) {
    return { ok: false, message: "Extensions are available during an active rental." };
  }

  const { data: existing } = await admin
    .from("market_extension_requests")
    .select("id")
    .eq("booking_id", booking.id)
    .eq("state", "pending")
    .limit(1)
    .maybeSingle();
  if (existing) {
    return { ok: false, message: "You already have a pending extension request." };
  }

  // New end at the same wall-clock time as the current end, on the
  // requested date (avoids shifting the handoff hour).
  const currentEnd = new Date(booking.ends_at);
  const [y, m, d] = parsed.data.newEndDate.split("-").map(Number);
  const newEnd = new Date(currentEnd);
  newEnd.setUTCFullYear(y, m - 1, d);
  const extensionDays = Math.round((newEnd.getTime() - currentEnd.getTime()) / DAY_MS);
  if (extensionDays < 1) {
    return { ok: false, message: "The new return date must be after the current one." };
  }
  if (extensionDays > 30) {
    return { ok: false, message: "Extensions are capped at 30 days — book again for longer." };
  }

  const [{ data: listing }, { data: sellerProfile }] = await Promise.all([
    admin
      .from("market_listings")
      .select("instant_book")
      .eq("id", booking.listing_id)
      .maybeSingle(),
    admin
      .from("market_seller_profiles")
      .select("state_code")
      .eq("organization_id", booking.organization_id)
      .maybeSingle(),
  ]);

  const conflict = await extensionConflicts(admin, booking as BookingRow, newEnd.toISOString());
  if (conflict) {
    return {
      ok: false,
      message: "Those extra days conflict with another booking on this item — message the seller to explore options.",
    };
  }

  const ext = priceExtension(booking as BookingRow, extensionDays, sellerProfile?.state_code ?? null);

  const { data: reqRow, error } = await admin
    .from("market_extension_requests")
    .insert({
      booking_id: booking.id,
      requested_by: user.id,
      previous_ends_at: booking.ends_at,
      requested_ends_at: newEnd.toISOString(),
      extension_days: extensionDays,
      subtotal_cents: ext.subtotal,
      tax_cents: ext.tax,
      fee_cents: ext.fee,
      payout_cents: ext.payout,
      expires_at: new Date(Date.now() + APPROVAL_WINDOW_MS).toISOString(),
    })
    .select("id")
    .single();
  if (error || !reqRow) return { ok: false, message: "Couldn't create the request — try again." };

  await admin.from("market_booking_events").insert({
    booking_id: booking.id,
    event: "extension.requested",
    actor: "renter",
    payload: { request_id: reqRow.id, days: extensionDays, total_cents: ext.subtotal + ext.tax },
  });

  // Getaround rule: instant-book + no conflict ⇒ approve & charge now.
  if (listing?.instant_book) {
    return chargeAndApply(admin, reqRow.id, booking as BookingRow, {
      requested_ends_at: newEnd.toISOString(),
      extension_days: extensionDays,
      subtotal_cents: ext.subtotal,
      tax_cents: ext.tax,
      fee_cents: ext.fee,
      payout_cents: ext.payout,
    }, true);
  }

  try {
    const { getBookingPartyEmails, notifyMarketEmail } = await import("@/lib/market/notify");
    const party = await getBookingPartyEmails(booking.id);
    if (party?.sellerEmail) {
      void notifyMarketEmail({
        kind: "extension_requested",
        to: party.sellerEmail,
        listingTitle: party.listingTitle,
        startsAt: party.startsAt,
        endsAt: newEnd.toISOString(),
        extra: `+${extensionDays} day${extensionDays === 1 ? "" : "s"}, $${((ext.subtotal + ext.tax) / 100).toFixed(2)} to the renter. Respond within 12 hours.`,
      });
    }
  } catch {
    // fire-and-forget
  }

  revalidatePath("/market/rentals");
  return {
    ok: true,
    message: `Request sent — the seller has 12 hours to approve. You'll be charged $${((ext.subtotal + ext.tax) / 100).toFixed(2)} only if they accept.`,
  };
}

async function loadPendingForSeller(requestId: string) {
  const ctx = await getOrgContext();
  if (!ctx) return null;
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  const { data: req } = await admin
    .from("market_extension_requests")
    .select("id, booking_id, state, requested_ends_at, extension_days, subtotal_cents, tax_cents, fee_cents, payout_cents")
    .eq("id", requestId)
    .maybeSingle();
  if (!req || req.state !== "pending") return null;
  const { data: booking } = await admin
    .from("market_bookings")
    .select(BOOKING_SELECT)
    .eq("id", req.booking_id)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!booking) return null;
  return { admin, req, booking: booking as BookingRow };
}

export async function approveExtension(formData: FormData): Promise<void> {
  const requestId = String(formData.get("request_id") ?? "");
  if (!z.string().uuid().safeParse(requestId).success) return;
  const loaded = await loadPendingForSeller(requestId);
  if (!loaded) return;
  const { admin, req, booking } = loaded;

  // Re-check conflicts at decision time (the window may have filled).
  if (await extensionConflicts(admin, booking, req.requested_ends_at)) {
    await admin
      .from("market_extension_requests")
      .update({ state: "declined", decided_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("state", "pending");
    revalidatePath("/dashboard/marketplace");
    revalidatePath("/market/hub");
    return;
  }

  await chargeAndApply(admin, requestId, booking, {
    requested_ends_at: req.requested_ends_at,
    extension_days: req.extension_days,
    subtotal_cents: req.subtotal_cents,
    tax_cents: req.tax_cents,
    fee_cents: req.fee_cents,
    payout_cents: req.payout_cents,
  }, false);
}

export async function declineExtension(formData: FormData): Promise<void> {
  const requestId = String(formData.get("request_id") ?? "");
  if (!z.string().uuid().safeParse(requestId).success) return;
  const loaded = await loadPendingForSeller(requestId);
  if (!loaded) return;
  const { admin, req, booking } = loaded;

  await admin
    .from("market_extension_requests")
    .update({ state: "declined", decided_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("state", "pending");

  await admin.from("market_booking_events").insert({
    booking_id: booking.id,
    event: "extension.declined",
    actor: "seller",
    payload: { request_id: req.id },
  });

  try {
    const { getBookingPartyEmails, notifyMarketEmail } = await import("@/lib/market/notify");
    const party = await getBookingPartyEmails(booking.id);
    if (party?.renterEmail) {
      void notifyMarketEmail({
        kind: "extension_declined",
        to: party.renterEmail,
        listingTitle: party.listingTitle,
        startsAt: party.startsAt,
        endsAt: booking.ends_at,
        extra: "The original return time stands — you weren't charged.",
      });
    }
  } catch {
    // fire-and-forget
  }

  revalidatePath("/dashboard/marketplace");
  revalidatePath("/market/hub");
  revalidatePath("/market/rentals");
}
