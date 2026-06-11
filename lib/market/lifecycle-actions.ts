"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { canTransition, type BookingState } from "@/lib/market/booking-state";

/**
 * Seller-driven booking lifecycle (spec §13 post-confirmation states):
 * confirmed → ready_for_handoff → checked_out → returned_pending_review
 * → completed. Each step is a guarded transition with an optional §16
 * evidence note recorded against market_handoff_evidence; photo
 * capture UI lands in the next M4 slice on the same table.
 *
 * Completion releases the inventory hold — the §14 recovery buffer is
 * inside the hold window, so release-at-completion is safe (the seller
 * marks complete after inspection, which is the §16 return flow).
 */

const SELLER_HUB_PATH = "/dashboard/marketplace";

type LifecycleStep = {
  to: BookingState;
  event: string;
  evidencePhase?: "handoff" | "return";
};

const STEPS: Record<string, LifecycleStep> = {
  ready: { to: "ready_for_handoff", event: "booking.ready_for_handoff" },
  checkout: { to: "checked_out", event: "booking.checked_out", evidencePhase: "handoff" },
  returned: {
    to: "returned_pending_review",
    event: "booking.returned_pending_review",
    evidencePhase: "return",
  },
  complete: { to: "completed", event: "booking.completed" },
};

export async function advanceBooking(formData: FormData): Promise<void> {
  if (!hasSupabaseEnv()) return;

  const bookingId = String(formData.get("booking_id") ?? "");
  const stepKey = String(formData.get("step") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 1000);
  if (!z.string().uuid().safeParse(bookingId).success) return;
  const step = STEPS[stepKey];
  if (!step) return;

  const ctx = await getOrgContext();
  if (!ctx) return;

  try {
    const key = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "market:lifecycle",
      actor: key,
      limit: 60,
      windowSeconds: 300,
      strict: true,
    });
    if (!limit.allowed) return;
  } catch {
    return;
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { data: booking } = await admin
    .from("market_bookings")
    .select(
      "id, state, hold_id, organization_id, deposit_status, stripe_deposit_intent_id, identity_verified_at",
    )
    .eq("id", bookingId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!booking) return;

  const from = booking.state as BookingState;
  if (!canTransition(from, step.to)) return;

  // Turo-model handoff gate: the item never checks out until the
  // seller has confirmed the renter's selfie matches their ID.
  if (step.to === "checked_out" && !booking.identity_verified_at) {
    await admin.from("market_booking_events").insert({
      booking_id: booking.id,
      event: "lifecycle.blocked_identity_unverified",
      actor: "system",
    });
    revalidatePath(SELLER_HUB_PATH);
    return;
  }

  const { data: updated } = await admin
    .from("market_bookings")
    .update({ state: step.to, updated_at: new Date().toISOString() })
    .eq("id", booking.id)
    .eq("state", from)
    .select("id")
    .maybeSingle();
  if (!updated) return; // raced — another actor moved it first

  await admin.from("market_booking_events").insert({
    booking_id: booking.id,
    event: step.event,
    actor: "seller",
  });

  if (step.to === "ready_for_handoff" || step.to === "completed") {
    try {
      const { getBookingPartyEmails, notifyMarketEmail } = await import("@/lib/market/notify");
      const party = await getBookingPartyEmails(booking.id);
      if (party) {
        void notifyMarketEmail({
          kind: step.to === "ready_for_handoff" ? "ready_for_handoff" : "booking_completed",
          to: party.renterEmail,
          listingTitle: party.listingTitle,
          startsAt: party.startsAt,
          endsAt: party.endsAt,
        });
      }
    } catch {
      // best-effort
    }
  }

  if (step.evidencePhase && note) {
    await admin.from("market_handoff_evidence").insert({
      booking_id: booking.id,
      phase: step.evidencePhase,
      party: "seller",
      note,
    });
  }

  if (step.to === "completed") {
    try {
      const { emitBridgeEvent } = await import("@/lib/market/bridge");
      await emitBridgeEvent({
        event: "marketplace.booking.completed",
        bookingId: booking.id,
        organizationId: booking.organization_id,
      });
    } catch {
      // best-effort
    }
    if (booking.hold_id) {
      await admin
        .from("market_reservation_holds")
        .update({ state: "released", updated_at: new Date().toISOString() })
        .eq("id", booking.hold_id);
    }

    // §9: completing the booking after return inspection RELEASES the
    // deposit auth hold. Disputes (later) capture it instead — that
    // path goes through the dispute domain, never this one.
    if (booking.deposit_status === "held" && booking.stripe_deposit_intent_id) {
      try {
        const { getStripe, hasStripeEnv } = await import("@/lib/stripe/config");
        if (hasStripeEnv()) {
          await getStripe().paymentIntents.cancel(booking.stripe_deposit_intent_id);
        }
        await admin
          .from("market_bookings")
          .update({ deposit_status: "released", updated_at: new Date().toISOString() })
          .eq("id", booking.id)
          .eq("deposit_status", "held");
        await admin.from("market_booking_events").insert({
          booking_id: booking.id,
          event: "deposit.released",
          actor: "system",
        });
      } catch {
        await admin.from("market_booking_events").insert({
          booking_id: booking.id,
          event: "deposit.release_failed",
          actor: "system",
        });
      }
    }
  }

  revalidatePath(SELLER_HUB_PATH);
}

/**
 * Turo-model identity check: the seller views the renter's ID + live
 * selfie (signed URLs rendered in the Seller Hub for ready_for_handoff
 * bookings) and confirms the person in front of them matches. Required
 * before EVERY checkout. A mismatch → the seller cancels (full refund)
 * or reports a no-show instead.
 */
export async function confirmRenterIdentity(formData: FormData): Promise<void> {
  if (!hasSupabaseEnv()) return;
  const bookingId = String(formData.get("booking_id") ?? "");
  if (!z.string().uuid().safeParse(bookingId).success) return;

  const ctx = await getOrgContext();
  if (!ctx) return;

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  const { data: updated } = await admin
    .from("market_bookings")
    .update({ identity_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", bookingId)
    .eq("organization_id", ctx.organizationId)
    .in("state", ["confirmed", "ready_for_handoff"])
    .is("identity_verified_at", null)
    .select("id")
    .maybeSingle();
  if (updated) {
    await admin.from("market_booking_events").insert({
      booking_id: bookingId,
      event: "identity.confirmed_by_seller",
      actor: "seller",
    });
  }
  revalidatePath(SELLER_HUB_PATH);
}
