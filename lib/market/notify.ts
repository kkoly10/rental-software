"use server";

import { hasSupabaseEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { escapeHtml } from "@/lib/maps/escape-html";
import { formatMarketDate } from "@/lib/market/time";

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
  | "booking_overdue" // → renter
  | "ready_for_handoff" // → renter (pickup instructions)
  | "booking_completed" // → renter (review prompt)
  | "booking_completed_seller" // → seller (follow-up prompt)
  | "pickup_reminder" // → renter (day before, time-based cron)
  | "return_reminder" // → renter (return day, time-based cron)
  | "return_due_nudge"; // → renter (grace window, time-based cron)

// Where the recipient acts on the email. Renter surfaces live on the
// marketplace subdomain; the Seller Hub lives in the operator app.
const RENTALS_URL = "https://rent.korent.app/market/rentals";
const MARKET_URL = "https://rent.korent.app/market";
const SELLER_HUB_URL = "https://korent.app/dashboard/marketplace";

type Cta = { label: string; url: string };

const COPY: Record<
  NotifyKind,
  { subject: string; body: (d: NotifyData) => string; cta?: Cta }
> = {
  request_received: {
    subject: "New booking request — respond within 24 hours",
    body: (d) =>
      `You have a new booking request for <b>${d.listingTitle}</b> (${d.dates}). Accept or decline within 24 hours — after that it auto-cancels and the renter is told you didn't respond.`,
    cta: { label: "Respond in Seller Hub", url: SELLER_HUB_URL },
  },
  request_approved: {
    subject: "Approved! Pay now to lock in your rental",
    body: (d) =>
      `The seller approved your request for <b>${d.listingTitle}</b> (${d.dates}). Pay within 24 hours from My Rentals to confirm — after that the slot is released.`,
    cta: { label: "Pay now", url: RENTALS_URL },
  },
  request_declined: {
    subject: "Your booking request was declined",
    body: (d) =>
      `The seller declined your request for <b>${d.listingTitle}</b> (${d.dates}). You weren't charged. Browse similar listings on the marketplace.`,
    cta: { label: "Browse the marketplace", url: MARKET_URL },
  },
  request_unavailable: {
    subject: "Those dates just became unavailable",
    body: (d) =>
      `Your request for <b>${d.listingTitle}</b> (${d.dates}) couldn't be confirmed — the dates were booked by someone else first. You weren't charged.`,
    cta: { label: "Browse the marketplace", url: MARKET_URL },
  },
  booking_confirmed_renter: {
    subject: "Booking confirmed 🎉",
    body: (d) =>
      `You're confirmed for <b>${d.listingTitle}</b> (${d.dates}). The refundable deposit authorizes close to handoff. Track everything in My Rentals.`,
    cta: { label: "View my rentals", url: RENTALS_URL },
  },
  booking_confirmed_seller: {
    subject: "You got booked — payment received",
    body: (d) =>
      `<b>${d.listingTitle}</b> is booked and paid for ${d.dates}. Check the Seller Hub for handoff steps; your payout releases per your Stripe schedule.`,
    cta: { label: "Open Seller Hub", url: SELLER_HUB_URL },
  },
  booking_cancelled: {
    subject: "Booking cancelled",
    body: (d) =>
      `The booking for <b>${d.listingTitle}</b> (${d.dates}) was cancelled. ${d.extra ?? ""} Details are on the booking.`,
  },
  ready_for_handoff: {
    subject: "Ready for pickup — bring your ID",
    body: (d) =>
      `<b>${d.listingTitle}</b> (${d.dates}) is ready for handoff. Bring the ID you verified with — the seller confirms it's you before the item leaves their hands.`,
    cta: { label: "View pickup details", url: RENTALS_URL },
  },
  booking_completed: {
    subject: "Rental complete — how did it go?",
    body: (d) =>
      `Your rental of <b>${d.listingTitle}</b> is complete. Your deposit hold releases automatically in 24 hours unless an issue is reported. Leave a review from My Rentals — it's how good sellers rise.`,
    cta: { label: "Leave a review", url: RENTALS_URL },
  },
  booking_completed_seller: {
    subject: "Rental complete — 30-second follow-up",
    body: (d) =>
      `<b>${d.listingTitle}</b> is complete. Take 30 seconds in the Seller Hub: confirm the item came back fine and flag anything off — it protects you and keeps bad actors off the marketplace.`,
    cta: { label: "Open Seller Hub", url: SELLER_HUB_URL },
  },
  pickup_reminder: {
    subject: "Pickup tomorrow — bring your verified ID",
    body: (d) =>
      `Your rental of <b>${d.listingTitle}</b> starts tomorrow (${d.dates}). Bring the ID you verified with — the seller confirms it's you at handoff. Both of you snap a quick photo of the item's condition before it leaves.`,
    cta: { label: "View pickup details", url: RENTALS_URL },
  },
  return_reminder: {
    subject: "Return day — wrap up your rental",
    body: (d) =>
      `<b>${d.listingTitle}</b> is due back today (${d.dates}). Snap a return photo when you hand it over — your deposit hold releases automatically after a clean return.`,
    cta: { label: "View return details", url: RENTALS_URL },
  },
  return_due_nudge: {
    subject: "Your rental is due back now",
    body: (d) =>
      `<b>${d.listingTitle}</b> was due back. There's a short grace window before late fees start (daily rate + $20 per started day) — return it now or message the seller if you're on the way.`,
    cta: { label: "View my rentals", url: RENTALS_URL },
  },
  booking_overdue: {
    subject: "Your rental is overdue — late fees now apply",
    body: (d) =>
      `<b>${d.listingTitle}</b> was due back and is now overdue. Per policy, each started late day charges the daily rate + $20 to your card. Return it as soon as possible.`,
    cta: { label: "View my rentals", url: RENTALS_URL },
  },
};

type NotifyData = {
  listingTitle: string;
  dates: string;
  extra?: string;
};

/**
 * Sender identity: split from the operator side. SaaS emails go out as
 * "{Business Name} <EMAIL_FROM_ADDRESS>"; marketplace emails as
 * "Korent Marketplace <marketplace@same-verified-domain>" so inbox
 * display, filters, and Resend analytics separate the two systems.
 * Override the address with MARKET_EMAIL_FROM_ADDRESS if needed.
 */
function marketFromAddress(): string {
  const explicit = process.env.MARKET_EMAIL_FROM_ADDRESS?.trim();
  const base = process.env.EMAIL_FROM_ADDRESS ?? "noreply@korent.app";
  const emailOnly = base.replace(/^.*<(.+)>$/, "$1").trim();
  const domain = emailOnly.includes("@") ? emailOnly.split("@")[1] : "korent.app";
  const address = explicit || `marketplace@${domain}`;
  return `Korent Marketplace <${address}>`;
}

/**
 * Marketplace email shell — same build quality as the operator
 * templates (table layout, inlined styles, bulletproof in Gmail/
 * Outlook) but in the marketplace's own warm palette (market.css):
 * cream canvas, ink text, orange CTA.
 */
function wrap(body: string, cta?: Cta): string {
  const button = cta
    ? `<a href="${cta.url}" style="display:inline-block;padding:13px 28px;background:#ff8c42;color:#2d1f14;border:2px solid #2d1f14;border-radius:999px;font-weight:700;font-size:14px;text-decoration:none;margin:20px 0 4px;">${cta.label}</a>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#fffaf5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#2d1f14;line-height:1.6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffaf5;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:1px solid #f0e4d8;overflow:hidden;">
        <tr>
          <td style="padding:22px 32px;border-bottom:1px solid #f0e4d8;">
            <img src="https://korent.app/icon-192x192.png" width="28" height="28" alt="" style="vertical-align:middle;border-radius:8px;margin-right:8px;" />
            <span style="font-size:20px;font-weight:800;color:#2d1f14;vertical-align:middle;">korent<span style="color:#e8590c;">.</span></span>
            <span style="font-size:12px;font-weight:600;color:#8a7565;letter-spacing:0.06em;text-transform:uppercase;margin-left:6px;vertical-align:middle;">marketplace</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0;font-size:15px;line-height:1.7;">${body}</p>
            ${button}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px;border-top:1px solid #f0e4d8;color:#8a7565;font-size:12px;">
            <a href="https://rent.korent.app" style="color:#8a7565;text-decoration:none;">rent.korent.app</a>
            &nbsp;·&nbsp;
            <a href="https://rent.korent.app/market/support" style="color:#8a7565;text-decoration:underline;">Questions? Get support</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
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
    const dates = `${formatMarketDate(input.startsAt)} → ${formatMarketDate(input.endsAt)}`;
    await sendEmail({
      to: input.to,
      from: marketFromAddress(),
      subject: `${tpl.subject} · Korent Marketplace`,
      // Bug #32: listingTitle/extra are user-controlled (seller sets the
      // title) — escape before they reach email HTML. dates is built
      // from our own formatter, safe.
      html: wrap(
        tpl.body({
          listingTitle: escapeHtml(input.listingTitle),
          dates,
          extra: input.extra ? escapeHtml(input.extra) : undefined,
        }),
        tpl.cta,
      ),
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
