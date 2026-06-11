"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";

/**
 * Marketplace transactional email (§24 communications matrix) — the
 * fix for the "silent marketplace" problem: every lifecycle change
 * that needs a human to act now sends an email. Fire-and-forget by
 * design (a mail failure must never break a booking), riding the
 * shared Resend pipe (lib/email — shared comms infra, boundary-safe).
 */

type NotifyKind =
  | "request_received" // → seller
  | "request_approved" // → renter (go pay)
  | "request_declined" // → renter
  | "request_unavailable" // → renter (approval failed on dates)
  | "booking_confirmed_renter"
  | "booking_confirmed_seller"
  | "booking_cancelled" // → other party
  | "booking_overdue"; // → renter

const COPY: Record<NotifyKind, { subject: string; body: (d: NotifyData) => string }> = {
  request_received: {
    subject: "New booking request — respond within 24 hours",
    body: (d) =>
      `You have a new booking request for <b>${d.listingTitle}</b> (${d.dates}). Accept or decline within 24 hours — after that it auto-cancels and the renter is told you didn't respond.`,
  },
  request_approved: {
    subject: "Approved! Pay now to lock in your rental",
    body: (d) =>
      `The seller approved your request for <b>${d.listingTitle}</b> (${d.dates}). Pay within 24 hours from My Rentals to confirm — after that the slot is released.`,
  },
  request_declined: {
    subject: "Your booking request was declined",
    body: (d) =>
      `The seller declined your request for <b>${d.listingTitle}</b> (${d.dates}). You weren't charged. Browse similar listings on the marketplace.`,
  },
  request_unavailable: {
    subject: "Those dates just became unavailable",
    body: (d) =>
      `Your request for <b>${d.listingTitle}</b> (${d.dates}) couldn't be confirmed — the dates were booked by someone else first. You weren't charged.`,
  },
  booking_confirmed_renter: {
    subject: "Booking confirmed 🎉",
    body: (d) =>
      `You're confirmed for <b>${d.listingTitle}</b> (${d.dates}). The refundable deposit authorizes close to handoff. Track everything in My Rentals.`,
  },
  booking_confirmed_seller: {
    subject: "You got booked — payment received",
    body: (d) =>
      `<b>${d.listingTitle}</b> is booked and paid for ${d.dates}. Check the Seller Hub for handoff steps; your payout releases per your Stripe schedule.`,
  },
  booking_cancelled: {
    subject: "Booking cancelled",
    body: (d) =>
      `The booking for <b>${d.listingTitle}</b> (${d.dates}) was cancelled. ${d.extra ?? ""} Details are on the booking.`,
  },
  booking_overdue: {
    subject: "Your rental is overdue — late fees now apply",
    body: (d) =>
      `<b>${d.listingTitle}</b> was due back and is now overdue. Per policy, each started late day charges the daily rate + $20 to your card. Return it as soon as possible.`,
  },
};

type NotifyData = {
  listingTitle: string;
  dates: string;
  extra?: string;
};

function wrap(body: string): string {
  return `<div style="font-family:sans-serif;max-width:520px"><h2 style="margin:0 0 12px">Korent Marketplace</h2><p style="font-size:15px;line-height:1.6">${body}</p><p style="font-size:12px;color:#8a7565">rent.korent.app · questions? rent.korent.app/market/support</p></div>`;
}

export async function notifyMarketEmail(input: {
  kind: NotifyKind;
  to: string | null | undefined;
  listingTitle: string;
  startsAt: string;
  endsAt: string;
  extra?: string;
}): Promise<void> {
  try {
    if (!input.to) return;
    const tpl = COPY[input.kind];
    const dates = `${new Date(input.startsAt).toLocaleDateString()} → ${new Date(input.endsAt).toLocaleDateString()}`;
    await sendEmail({
      to: input.to,
      subject: `${tpl.subject} · Korent Marketplace`,
      html: wrap(tpl.body({ listingTitle: input.listingTitle, dates, extra: input.extra })),
    });
  } catch {
    // fire-and-forget by design
  }
}

/** Look up the two parties' emails for a booking (admin client). */
export async function getBookingPartyEmails(bookingId: string): Promise<{
  renterEmail: string | null;
  sellerEmail: string | null;
  listingTitle: string;
  startsAt: string;
  endsAt: string;
} | null> {
  if (!hasSupabaseEnv()) return null;
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { data: b } = await admin
    .from("market_bookings")
    .select(
      "id, starts_at, ends_at, renter_profile_id, organization_id, market_listings ( title )",
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!b) return null;

  const [{ data: renter }, { data: ownerMembership }] = await Promise.all([
    admin.from("profiles").select("email").eq("id", b.renter_profile_id).maybeSingle(),
    admin
      .from("organization_memberships")
      .select("profiles ( email )")
      .eq("organization_id", b.organization_id)
      .eq("role", "owner")
      .eq("status", "active")
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    renterEmail: renter?.email ?? null,
    sellerEmail:
      (ownerMembership as { profiles?: { email?: string | null } | null } | null)?.profiles
        ?.email ?? null,
    listingTitle:
      (b.market_listings as unknown as { title: string } | null)?.title ?? "Marketplace rental",
    startsAt: b.starts_at,
    endsAt: b.ends_at,
  };
}
