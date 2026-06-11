"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { isPlatformAdmin } from "@/lib/market/admin";

/**
 * Post-rental follow-up (founder decision 2026-06-11): a short
 * structured survey from each party after completion. Anything
 * concerning (item issue, suspicious behavior, overall=problem) flags
 * straight into the platform trust queue; the renter is also pointed
 * at the dispute flow if the issue needs money to move.
 */

export type FollowupState = { ok: boolean; message: string };

const schema = z.object({
  bookingId: z.string().uuid(),
  overall: z.enum(["great", "okay", "problem"]),
  itemIssue: z.coerce.boolean(),
  suspicious: z.coerce.boolean(),
  wouldRepeat: z.enum(["yes", "no", ""]).optional(),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export async function submitFollowup(
  _prev: FollowupState,
  formData: FormData,
): Promise<FollowupState> {
  if (!hasSupabaseEnv()) return { ok: false, message: "Unavailable right now." };

  const parsed = schema.safeParse({
    bookingId: formData.get("booking_id"),
    overall: formData.get("overall") ?? "great",
    itemIssue: formData.get("item_issue") === "on",
    suspicious: formData.get("suspicious") === "on",
    wouldRepeat: formData.get("would_repeat") ?? "",
    notes: String(formData.get("notes") ?? "").trim(),
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
      scope: "market:followup",
      actor: key,
      limit: 20,
      windowSeconds: 3600,
      strict: true,
    });
    if (!limit.allowed) return { ok: false, message: "Too many submissions — try later." };
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
  if (booking.state !== "completed") {
    return { ok: false, message: "Follow-ups open once the rental is completed." };
  }

  let party: "renter" | "seller" | null = null;
  if (booking.renter_profile_id === user.id) party = "renter";
  else {
    const ctx = await getOrgContext();
    if (ctx && ctx.organizationId === booking.organization_id) party = "seller";
  }
  if (!party) return { ok: false, message: "You're not a party to this booking." };

  const flagged =
    parsed.data.itemIssue || parsed.data.suspicious || parsed.data.overall === "problem";

  const { error } = await admin.from("market_followups").insert({
    booking_id: booking.id,
    party,
    overall: parsed.data.overall,
    item_issue: parsed.data.itemIssue,
    suspicious: parsed.data.suspicious,
    would_repeat:
      party === "seller" && parsed.data.wouldRepeat
        ? parsed.data.wouldRepeat === "yes"
        : null,
    notes: parsed.data.notes || null,
    status: flagged ? "flagged" : "clean",
  });
  if (error) {
    if (error.code === "23505") return { ok: false, message: "You already submitted this follow-up." };
    return { ok: false, message: "Couldn't save — try again." };
  }

  await admin.from("market_booking_events").insert({
    booking_id: booking.id,
    event: `followup.${party}${flagged ? ".flagged" : ""}`,
    actor: party,
    payload: {
      overall: parsed.data.overall,
      item_issue: parsed.data.itemIssue,
      suspicious: parsed.data.suspicious,
    },
  });

  revalidatePath("/market/rentals");
  revalidatePath("/dashboard/marketplace");
  return {
    ok: true,
    message: flagged
      ? "Thanks — flagged for the trust team. If money needs to move (damage, missing parts), open a dispute from the booking too."
      : "Thanks — glad it went smoothly.",
  };
}



export async function markFollowupReviewed(formData: FormData): Promise<void> {
  const id = String(formData.get("followup_id") ?? "");
  if (!z.string().uuid().safeParse(id).success || !hasSupabaseEnv()) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isPlatformAdmin(user.email)) return;

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  await admin
    .from("market_followups")
    .update({ status: "reviewed" })
    .eq("id", id)
    .eq("status", "flagged");
  revalidatePath("/dashboard/market-admin");
}
