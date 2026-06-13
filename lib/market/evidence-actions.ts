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
const MAX_PHOTOS = 6;
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

  // Phase 1 (locked rental flow): up to 6 photos per submit, one
  // evidence row each. The seller before-photos gate (≥2) is enforced
  // at checkout in lifecycle-actions; here we just store what's given.
  const files = formData
    .getAll("photo")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_PHOTOS);
  // Each entry is a PRIVATE-bucket storage path (#39), never a URL.
  const photoPaths: string[] = [];

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { ok: false, message: "Only JPEG, PNG, or WebP photos are allowed." };
    }
    const sniffed = await sniffImageType(file);
    if (!sniffed || !ALLOWED_TYPES.includes(sniffed)) {
      return { ok: false, message: "File content doesn't match a supported image format." };
    }
    if (file.size > MAX_SIZE) {
      return { ok: false, message: "Each photo must be under 20 MB." };
    }
    const ext = MIME_TO_EXT[sniffed] ?? "jpg";
    const filePath = `${booking.id}/${parsed.data.phase}-${party}-${Date.now()}-${photoPaths.length}.${ext}`;
    const { error: uploadError } = await admin.storage
      .from(EVIDENCE_BUCKET)
      .upload(filePath, file, { contentType: sniffed, upsert: false });
    if (uploadError) {
      return { ok: false, message: "Upload failed — please try again." };
    }
    photoPaths.push(filePath);
  }

  if (photoPaths.length === 0 && !parsed.data.note) {
    return { ok: false, message: "Add at least one photo (or a note)." };
  }

  // One row per photo; a note-only submit writes a single row.
  const rows =
    photoPaths.length > 0
      ? photoPaths.map((p, i) => ({
          booking_id: booking.id,
          phase: parsed.data.phase,
          party,
          photo_url: p,
          // Attach the note to the first photo only.
          note: i === 0 ? parsed.data.note || null : null,
        }))
      : [
          {
            booking_id: booking.id,
            phase: parsed.data.phase,
            party,
            photo_url: null,
            note: parsed.data.note || null,
          },
        ];

  const { error } = await admin.from("market_handoff_evidence").insert(rows);
  if (error) return { ok: false, message: "Couldn't save the evidence." };

  await admin.from("market_booking_events").insert({
    booking_id: booking.id,
    event: `evidence.${parsed.data.phase}.${party}`,
    actor: party,
    payload: { photo_count: photoPaths.length },
  });

  revalidatePath("/market/rentals");
  revalidatePath("/dashboard/marketplace");
  revalidatePath("/market/hub");
  const n = photoPaths.length;
  return {
    ok: true,
    message:
      n > 0
        ? `Saved ${n} photo${n === 1 ? "" : "s"} — attached to the booking.`
        : "Note saved — attached to the booking.",
  };
}
