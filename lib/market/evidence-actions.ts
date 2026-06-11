"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { sniffImageType } from "@/lib/utils/image-signature";
import type { BookingState } from "@/lib/market/booking-state";

/**
 * §16 evidence capture: either party photographs the item at handoff
 * and at return; rows are preserved on the booking for disputes.
 *
 * Bug #39: evidence is private dispute material — it lands in the PRIVATE
 * `market-evidence` bucket (service-role writes, admin signed-URL reads),
 * NOT the public `uploads` bucket. `photo_url` therefore stores the
 * storage PATH, not a world-readable getPublicUrl() link.
 */

export type EvidenceState = { ok: boolean; message: string };

const EVIDENCE_BUCKET = "market-evidence";
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 20 * 1024 * 1024;
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Booking states in which evidence may be submitted, by phase. */
const PHASE_STATES: Record<"handoff" | "return", BookingState[]> = {
  handoff: ["ready_for_handoff", "checked_out"],
  return: ["checked_out", "overdue", "returned_pending_review"],
};

const schema = z.object({
  bookingId: z.string().uuid(),
  phase: z.enum(["handoff", "return"]),
  note: z.string().max(1000).optional().or(z.literal("")),
});

export async function submitEvidence(
  _prev: EvidenceState,
  formData: FormData,
): Promise<EvidenceState> {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Evidence upload is unavailable in this environment." };
  }

  const parsed = schema.safeParse({
    bookingId: formData.get("booking_id"),
    phase: formData.get("phase"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { ok: false, message: "Invalid submission." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  try {
    const key = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "market:evidence",
      actor: key,
      limit: 30,
      windowSeconds: 300,
      strict: true,
    });
    if (!limit.allowed) return { ok: false, message: "Too many uploads — try again soon." };
  } catch {
    return { ok: false, message: "Try again shortly." };
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { data: booking } = await admin
    .from("market_bookings")
    .select("id, state, renter_profile_id, organization_id")
    .eq("id", parsed.data.bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, message: "Booking not found." };

  // Party resolution: renter by profile match, seller by org membership.
  let party: "renter" | "seller" | null = null;
  if (booking.renter_profile_id === user.id) party = "renter";
  else {
    const ctx = await getOrgContext();
    if (ctx && ctx.organizationId === booking.organization_id) party = "seller";
  }
  if (!party) return { ok: false, message: "You're not a party to this booking." };

  if (!PHASE_STATES[parsed.data.phase].includes(booking.state as BookingState)) {
    return {
      ok: false,
      message: `${parsed.data.phase === "handoff" ? "Handoff" : "Return"} evidence isn't open for this booking right now.`,
    };
  }

  // Photo is optional only when a note is present; §16 wants photos,
  // so the UI labels the photo as the primary input.
  const file = formData.get("photo");
  // Holds the PRIVATE-bucket storage path (not a public URL) — see #39.
  let photoPath: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { ok: false, message: "Only JPEG, PNG, or WebP photos are allowed." };
    }
    const sniffed = await sniffImageType(file);
    if (!sniffed || !ALLOWED_TYPES.includes(sniffed)) {
      return { ok: false, message: "File content doesn't match a supported image format." };
    }
    if (file.size > MAX_SIZE) {
      return { ok: false, message: "Photo must be under 20 MB." };
    }

    const ext = MIME_TO_EXT[sniffed] ?? "jpg";
    const filePath = `${booking.id}/${parsed.data.phase}-${party}-${Date.now()}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from(EVIDENCE_BUCKET)
      .upload(filePath, file, { contentType: sniffed, upsert: false });
    if (uploadError) {
      return { ok: false, message: "Upload failed — please try again." };
    }
    // Private bucket: store the path; admin/dispute views read it via
    // createSignedUrl(). Never getPublicUrl() here.
    photoPath = filePath;
  } else if (!parsed.data.note) {
    return { ok: false, message: "Add a photo (or at least a note)." };
  }

  const { error } = await admin.from("market_handoff_evidence").insert({
    booking_id: booking.id,
    phase: parsed.data.phase,
    party,
    photo_url: photoPath,
    note: parsed.data.note || null,
  });
  if (error) return { ok: false, message: "Couldn't save the evidence." };

  await admin.from("market_booking_events").insert({
    booking_id: booking.id,
    event: `evidence.${parsed.data.phase}.${party}`,
    actor: party,
    payload: { has_photo: Boolean(photoPath) },
  });

  revalidatePath("/market/rentals");
  revalidatePath("/dashboard/marketplace");
  return { ok: true, message: "Evidence saved — it's attached to the booking." };
}
