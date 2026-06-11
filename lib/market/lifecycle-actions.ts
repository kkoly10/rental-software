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
    .select("id, state, hold_id, organization_id")
    .eq("id", bookingId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!booking) return;

  const from = booking.state as BookingState;
  if (!canTransition(from, step.to)) return;

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

  if (step.evidencePhase && note) {
    await admin.from("market_handoff_evidence").insert({
      booking_id: booking.id,
      phase: step.evidencePhase,
      party: "seller",
      note,
    });
  }

  if (step.to === "completed" && booking.hold_id) {
    await admin
      .from("market_reservation_holds")
      .update({ state: "released", updated_at: new Date().toISOString() })
      .eq("id", booking.hold_id);
  }

  revalidatePath(SELLER_HUB_PATH);
}
