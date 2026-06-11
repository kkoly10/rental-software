"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { canTransition, type BookingState } from "@/lib/market/booking-state";

/**
 * Disputes / claims (§17). Opening is party-gated and only legal in
 * post-checkout states (the §13 machine enforces it). Resolution is a
 * PLATFORM-ADMIN action (PLATFORM_ADMIN_EMAILS env, comma-separated)
 * and is the ONLY code path allowed to capture a deposit hold.
 */

export type DisputeActionState = { ok: boolean; message: string };

const DISPUTE_TYPES = [
  "item_not_working",
  "damage",
  "missing_accessories",
  "late_return",
  "non_return",
  "condition_mismatch",
  "seller_no_show",
  "renter_no_show",
  "billing_issue",
] as const;

const openSchema = z.object({
  bookingId: z.string().uuid(),
  disputeType: z.enum(DISPUTE_TYPES),
  description: z.string().min(10, "Describe the issue (at least 10 characters).").max(2000),
});

export async function openDispute(
  _prev: DisputeActionState,
  formData: FormData,
): Promise<DisputeActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Disputes are unavailable in this environment." };
  }
  const parsed = openSchema.safeParse({
    bookingId: formData.get("booking_id"),
    disputeType: formData.get("dispute_type"),
    description: String(formData.get("description") ?? "").trim(),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  try {
    const key = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "market:dispute",
      actor: key,
      limit: 5,
      windowSeconds: 3600,
      strict: true,
    });
    if (!limit.allowed) return { ok: false, message: "Too many disputes opened — contact support." };
  } catch {
    return { ok: false, message: "Try again shortly." };
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { data: booking } = await admin
    .from("market_bookings")
    .select("id, state, renter_profile_id, organization_id, claim_window_ends_at")
    .eq("id", parsed.data.bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, message: "Booking not found." };

  let party: "renter" | "seller" | null = null;
  if (booking.renter_profile_id === user.id) party = "renter";
  else {
    const ctx = await getOrgContext();
    if (ctx && ctx.organizationId === booking.organization_id) party = "seller";
  }
  if (!party) return { ok: false, message: "You're not a party to this booking." };

  const from = booking.state as BookingState;
  if (!canTransition(from, "disputed")) {
    return { ok: false, message: "Disputes open after handoff — message the seller for pre-rental issues." };
  }
  // Turo-style claim window: completed bookings can dispute only
  // within 24h of completion (while the deposit hold is still alive).
  if (from === "completed") {
    const windowEnds = booking.claim_window_ends_at
      ? new Date(booking.claim_window_ends_at)
      : null;
    if (!windowEnds || windowEnds < new Date()) {
      return {
        ok: false,
        message: "The 24-hour post-completion claim window has passed — contact support instead.",
      };
    }
  }

  const { data: dispute, error } = await admin
    .from("market_disputes")
    .insert({
      booking_id: booking.id,
      opened_by: party,
      opener_profile_id: user.id,
      dispute_type: parsed.data.disputeType,
      description: parsed.data.description,
    })
    .select("id")
    .single();
  if (error || !dispute) return { ok: false, message: "Couldn't open the dispute." };

  await admin
    .from("market_bookings")
    .update({ state: "disputed", updated_at: new Date().toISOString() })
    .eq("id", booking.id)
    .eq("state", from);
  await admin.from("market_booking_events").insert({
    booking_id: booking.id,
    event: "dispute.opened",
    actor: party,
    payload: { dispute_id: dispute.id, type: parsed.data.disputeType },
  });

  revalidatePath("/market/rentals");
  revalidatePath("/dashboard/marketplace");
  return {
    ok: true,
    message:
      "Dispute opened. Both parties' evidence is attached to the booking; support will review within 72 hours.",
  };
}

// ── Admin resolution (§17/§19) ───────────────────────────────────────

function isPlatformAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  const list = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

const resolveSchema = z.object({
  disputeId: z.string().uuid(),
  outcome: z.enum([
    "resolved_renter_liable",
    "resolved_seller_liable",
    "resolved_split",
    "resolved_no_fault",
  ]),
  captureCents: z.coerce.number().int().min(0).default(0),
  refundCents: z.coerce.number().int().min(0).default(0),
  note: z.string().min(5).max(2000),
});

export async function resolveDispute(
  _prev: DisputeActionState,
  formData: FormData,
): Promise<DisputeActionState> {
  if (!hasSupabaseEnv()) return { ok: false, message: "Unavailable." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdmin(user.email)) {
    return { ok: false, message: "Platform admin only." };
  }

  const parsed = resolveSchema.safeParse({
    disputeId: formData.get("dispute_id"),
    outcome: formData.get("outcome"),
    captureCents: formData.get("capture_cents") || 0,
    refundCents: formData.get("refund_cents") || 0,
    note: String(formData.get("note") ?? "").trim(),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid input." };
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { data: dispute } = await admin
    .from("market_disputes")
    .select("id, status, booking_id")
    .eq("id", parsed.data.disputeId)
    .maybeSingle();
  if (!dispute) return { ok: false, message: "Dispute not found." };
  if (dispute.status.startsWith("resolved") || dispute.status === "closed") {
    return { ok: false, message: "Already resolved." };
  }

  const { data: booking } = await admin
    .from("market_bookings")
    .select(
      "id, state, hold_id, deposit_status, deposit_cents, stripe_deposit_intent_id, stripe_payment_intent_id, subtotal_cents, tax_cents, refund_cents",
    )
    .eq("id", dispute.booking_id)
    .maybeSingle();
  if (!booking) return { ok: false, message: "Booking not found." };

  // Refund lever (review fix 2026-06-11): seller-liable/split/no-fault
  // outcomes can now send rental money back to the renter — the same
  // proportional Stripe call the cancellation engine uses (reverses
  // the seller transfer + platform fee + tax in ratio). Clamped to
  // what's still refundable on the charge.
  let refunded = 0;
  const wantsRefund =
    parsed.data.refundCents > 0 && parsed.data.outcome !== "resolved_renter_liable";
  if (wantsRefund) {
    if (!booking.stripe_payment_intent_id) {
      return { ok: false, message: "No payment on file to refund." };
    }
    const charged = booking.subtotal_cents + (booking.tax_cents ?? 0);
    const refundable = Math.max(charged - (booking.refund_cents ?? 0), 0);
    const amount = Math.min(parsed.data.refundCents, refundable);
    if (amount > 0) {
      try {
        const { getStripe, hasStripeEnv } = await import("@/lib/stripe/config");
        if (!hasStripeEnv()) return { ok: false, message: "Stripe not configured." };
        await getStripe().refunds.create({
          payment_intent: booking.stripe_payment_intent_id,
          amount,
          reverse_transfer: true,
          refund_application_fee: true,
        });
        refunded = amount;
        await admin
          .from("market_bookings")
          .update({
            refund_cents: (booking.refund_cents ?? 0) + amount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", booking.id);
      } catch {
        return { ok: false, message: "Refund failed — check the payment in Stripe, then resolve again." };
      }
    }
  }

  // §9/§17: deposit capture happens HERE and only here. Renter-liable
  // (or split) outcomes may capture up to the held amount; everything
  // else releases the hold.
  let captured = 0;
  const wantsCapture =
    parsed.data.captureCents > 0 &&
    (parsed.data.outcome === "resolved_renter_liable" ||
      parsed.data.outcome === "resolved_split");

  if (booking.deposit_status === "held" && booking.stripe_deposit_intent_id) {
    // Bug #8: CAS held → capturing BEFORE touching Stripe, so the
    // claim-window release cron can't act on the same intent. If the CAS
    // loses, the cron already released it — nothing to capture.
    const { data: claimed } = await admin
      .from("market_bookings")
      .update({ deposit_status: "capturing", updated_at: new Date().toISOString() })
      .eq("id", booking.id)
      .eq("deposit_status", "held")
      .select("id")
      .maybeSingle();
    if (!claimed) {
      return { ok: false, message: "The deposit hold was just released (claim window elapsed) — no capture possible." };
    }
    try {
      const { getStripe, hasStripeEnv } = await import("@/lib/stripe/config");
      if (!hasStripeEnv()) return { ok: false, message: "Stripe not configured." };
      const stripe = getStripe();
      if (wantsCapture) {
        const amount = Math.min(parsed.data.captureCents, booking.deposit_cents);
        await stripe.paymentIntents.capture(booking.stripe_deposit_intent_id, {
          amount_to_capture: amount,
        });
        captured = amount;
        await admin
          .from("market_bookings")
          .update({ deposit_status: "captured", updated_at: new Date().toISOString() })
          .eq("id", booking.id)
          .eq("deposit_status", "capturing");
      } else {
        await stripe.paymentIntents.cancel(booking.stripe_deposit_intent_id);
        await admin
          .from("market_bookings")
          .update({ deposit_status: "released", updated_at: new Date().toISOString() })
          .eq("id", booking.id)
          .eq("deposit_status", "capturing");
      }
    } catch {
      // Roll the CAS back so a retry can act on the still-live intent.
      await admin
        .from("market_bookings")
        .update({ deposit_status: "held", updated_at: new Date().toISOString() })
        .eq("id", booking.id)
        .eq("deposit_status", "capturing");
      return { ok: false, message: "Stripe deposit action failed — resolve again after checking the intent." };
    }
  }

  await admin
    .from("market_disputes")
    .update({
      status: parsed.data.outcome,
      resolution_note: parsed.data.note,
      deposit_captured_cents: captured,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", dispute.id);

  // §13: disputed → completed once resolved.
  if ((booking.state as BookingState) === "disputed") {
    await admin
      .from("market_bookings")
      .update({ state: "completed", updated_at: new Date().toISOString() })
      .eq("id", booking.id)
      .eq("state", "disputed");
    if (booking.hold_id) {
      await admin
        .from("market_reservation_holds")
        .update({ state: "released", updated_at: new Date().toISOString() })
        .eq("id", booking.hold_id);
    }
  }

  await admin.from("market_booking_events").insert({
    booking_id: booking.id,
    event: "dispute.resolved",
    actor: "admin",
    payload: { outcome: parsed.data.outcome, captured_cents: captured, refunded_cents: refunded },
  });

  revalidatePath("/dashboard/market-admin");
  return {
    ok: true,
    message: `Resolved (${parsed.data.outcome.replace("resolved_", "")})${captured ? ` — captured $${(captured / 100).toFixed(2)} from the deposit` : ""}${refunded ? ` — refunded $${(refunded / 100).toFixed(2)} to the renter` : ""}.`,
  };
}
