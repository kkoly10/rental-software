"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";

/**
 * Verified-rental reviews: renter-only, completed bookings only, one
 * per booking (DB unique). These feed ranking (§21) and the store
 * page's public trust signals.
 */

export type ReviewActionState = { ok: boolean; message: string };

const schema = z.object({
  bookingId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().max(1000).optional().or(z.literal("")),
});

export async function submitReview(
  _prev: ReviewActionState,
  formData: FormData,
): Promise<ReviewActionState> {
  if (!hasSupabaseEnv()) return { ok: false, message: "Reviews are unavailable right now." };

  const parsed = schema.safeParse({
    bookingId: formData.get("booking_id"),
    rating: formData.get("rating"),
    body: String(formData.get("body") ?? "").trim(),
  });
  if (!parsed.success) return { ok: false, message: "Pick a rating from 1 to 5." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  try {
    const key = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "market:review",
      actor: key,
      limit: 10,
      windowSeconds: 3600,
      strict: true,
    });
    if (!limit.allowed) return { ok: false, message: "Too many reviews — try later." };
  } catch {
    return { ok: false, message: "Try again shortly." };
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { data: booking } = await admin
    .from("market_bookings")
    .select("id, state, renter_profile_id, listing_id, organization_id")
    .eq("id", parsed.data.bookingId)
    .eq("renter_profile_id", user.id)
    .maybeSingle();
  if (!booking) return { ok: false, message: "Booking not found." };
  if (booking.state !== "completed") {
    return { ok: false, message: "Reviews open once the rental is completed." };
  }

  const { error } = await admin.from("market_reviews").insert({
    booking_id: booking.id,
    listing_id: booking.listing_id,
    organization_id: booking.organization_id,
    renter_profile_id: user.id,
    rating: parsed.data.rating,
    body: parsed.data.body || null,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "You already reviewed this rental." };
    return { ok: false, message: "Couldn't save the review." };
  }

  revalidatePath("/market/rentals");
  return { ok: true, message: "Review posted — thanks for keeping the marketplace honest." };
}
