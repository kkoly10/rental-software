"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  blockedMessageCopy,
  moderateMessage,
  type ConversationPhase,
} from "@/lib/market/moderation";

/**
 * Conversation actions (§18/§26): one thread per renter × listing,
 * server-action-only writes, every message through the moderation
 * engine. Blocked messages are rejected (never stored); soft-warned
 * messages are stored with their reasons for trust scoring.
 */

export type MessageActionState = { ok: boolean; message: string; conversationId?: string };

async function rateLimited(): Promise<boolean> {
  try {
    const key = await getActionClientKey();
    const limit = await enforceRateLimit({
      scope: "market:message",
      actor: key,
      limit: 60,
      windowSeconds: 300,
      strict: true,
    });
    return !limit.allowed;
  } catch {
    return true;
  }
}

const sendSchema = z.object({
  body: z.string().min(1, "Write a message first.").max(2000),
  listingId: z.string().uuid().optional().or(z.literal("")),
  conversationId: z.string().uuid().optional().or(z.literal("")),
});

export async function sendMarketMessage(
  _prev: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  if (!hasSupabaseEnv()) {
    return { ok: false, message: "Messaging is unavailable in this environment." };
  }
  const parsed = sendSchema.safeParse({
    body: String(formData.get("body") ?? "").trim(),
    listingId: formData.get("listing_id") ?? "",
    conversationId: formData.get("conversation_id") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.errors[0]?.message ?? "Invalid message." };
  }
  if (!parsed.data.listingId && !parsed.data.conversationId) {
    return { ok: false, message: "Missing conversation context." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to send messages." };
  if (await rateLimited()) {
    return { ok: false, message: "Too many messages — slow down a moment." };
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  const ctx = await getOrgContext();

  // Resolve (or create) the conversation and the sender's party.
  let conversation: {
    id: string;
    phase: string;
    renter_profile_id: string;
    organization_id: string;
    leakage_score: number | null;
    flagged_at: string | null;
  } | null = null;

  if (parsed.data.conversationId) {
    const { data } = await admin
      .from("market_conversations")
      .select("id, phase, renter_profile_id, organization_id, leakage_score, flagged_at")
      .eq("id", parsed.data.conversationId)
      .maybeSingle();
    conversation = data;
  } else if (parsed.data.listingId) {
    const { data: listing } = await admin
      .from("market_listings")
      .select("id, organization_id, status")
      .eq("id", parsed.data.listingId)
      .eq("status", "published")
      .maybeSingle();
    if (!listing) return { ok: false, message: "This listing is no longer available." };
    if (ctx && ctx.organizationId === listing.organization_id) {
      return { ok: false, message: "This is your own listing." };
    }
    const { data: existing } = await admin
      .from("market_conversations")
      .select("id, phase, renter_profile_id, organization_id, leakage_score, flagged_at")
      .eq("listing_id", listing.id)
      .eq("renter_profile_id", user.id)
      .maybeSingle();
    conversation =
      existing ??
      (
        await admin
          .from("market_conversations")
          .insert({
            listing_id: listing.id,
            organization_id: listing.organization_id,
            renter_profile_id: user.id,
          })
          .select("id, phase, renter_profile_id, organization_id, leakage_score, flagged_at")
          .single()
      ).data;
  }
  if (!conversation) return { ok: false, message: "Couldn't open the conversation." };

  let party: "renter" | "seller" | null = null;
  if (conversation.renter_profile_id === user.id) party = "renter";
  else if (ctx && ctx.organizationId === conversation.organization_id) party = "seller";
  if (!party) return { ok: false, message: "You're not a party to this conversation." };

  // §20 moderation, phase-aware (§24).
  const verdict = moderateMessage(parsed.data.body, conversation.phase as ConversationPhase);

  // Bug #45/#59: leakage scoring + escalation. A blocked attempt is a
  // strong off-platform signal; a soft-warn is a weak one. Crossing the
  // threshold flags the thread into the trust queue, so repeated probing
  // has consequences instead of being a free retry loop.
  if (verdict.verdict !== "clean") {
    const weight = verdict.verdict === "blocked" ? 3 : 1;
    const next = (conversation.leakage_score ?? 0) + weight;
    await admin
      .from("market_conversations")
      .update({
        leakage_score: next,
        ...(next >= 6 && !conversation.flagged_at
          ? { flagged_at: new Date().toISOString() }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
  }

  if (verdict.verdict === "blocked") {
    return { ok: false, message: blockedMessageCopy(verdict.reasons) };
  }

  const { error } = await admin.from("market_messages").insert({
    conversation_id: conversation.id,
    sender_party: party,
    sender_profile_id: user.id,
    body: parsed.data.body,
    moderation: verdict.verdict,
    moderation_reasons: verdict.reasons.length ? verdict.reasons : null,
  });
  if (error) return { ok: false, message: "Couldn't send — try again." };

  await admin
    .from("market_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversation.id);

  revalidatePath(`/market/messages/${conversation.id}`);
  revalidatePath("/market/messages");
  revalidatePath("/dashboard/marketplace");
  return {
    ok: true,
    message:
      verdict.verdict === "soft_warn"
        ? "Sent — a reminder: keep coordination and payment on the platform."
        : "Sent.",
    conversationId: conversation.id,
  };
}

/**
 * Called when a booking confirms: links the thread to the booking and
 * opens the coordination phase (§24 — contact sharing becomes legal).
 */
export async function openCoordinationPhase(input: {
  listingId: string;
  renterProfileId: string;
  bookingId: string;
}): Promise<void> {
  if (!hasSupabaseEnv()) return;
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  await admin
    .from("market_conversations")
    .update({
      booking_id: input.bookingId,
      phase: "coordination",
      updated_at: new Date().toISOString(),
    })
    .eq("listing_id", input.listingId)
    .eq("renter_profile_id", input.renterProfileId);
}
