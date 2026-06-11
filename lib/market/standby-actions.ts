"use server";

import { z } from "zod";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActionClientKey } from "@/lib/security/action-client";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { marketWallClock } from "@/lib/market/time";

/**
 * Standby queue (roadmap item 6, master plan §10) — the feature no
 * P2P rental platform ships: "notify me if it frees up."
 * Research-locked: SEQUENTIAL offers with a 3h exclusivity window
 * (hotel pattern), broadcast to all remaining waiters inside 48h of
 * the rental start. v1 offers are exclusive notifications, not
 * blocking holds — an offer-hold would block the claimant's own
 * booking in the capacity math; being first to know IS the priority.
 */

export type StandbyState = { ok: boolean; message: string };

const OFFER_TTL_MS = 3 * 3600_000;
const BROADCAST_WITHIN_MS = 48 * 3600_000;

const joinSchema = z.object({
  listingId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  quantity: z.coerce.number().int().min(1).max(10_000).default(1),
});

export async function joinStandby(
  _prev: StandbyState,
  formData: FormData,
): Promise<StandbyState> {
  if (!hasSupabaseEnv()) return { ok: false, message: "Unavailable in this environment." };
  const parsed = joinSchema.safeParse({
    listingId: formData.get("listing_id"),
    startDate: formData.get("start_date"),
    endDate: formData.get("end_date"),
    quantity: formData.get("quantity") || 1,
  });
  if (!parsed.success) return { ok: false, message: "Pick valid dates first." };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to join the standby list." };

  try {
    const key = await getActionClientKey();
    const r = await enforceRateLimit({
      scope: "market:standby-join",
      actor: key,
      limit: 10,
      windowSeconds: 300,
      strict: true,
    });
    if (!r.allowed) return { ok: false, message: "Too many requests — try again shortly." };
  } catch {
    return { ok: false, message: "Try again shortly." };
  }

  const startsAt = marketWallClock(parsed.data.startDate, 9, 0);
  const endsAt = marketWallClock(parsed.data.endDate, 18, 0);
  if (!(startsAt > new Date()) || !(endsAt > startsAt)) {
    return { ok: false, message: "Pick future dates." };
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { data: listing } = await admin
    .from("market_listings")
    .select("id, status, is_prelist")
    .eq("id", parsed.data.listingId)
    .maybeSingle();
  if (!listing || listing.status !== "published" || listing.is_prelist) {
    return { ok: false, message: "This listing isn't taking standby requests." };
  }

  const { data: existing } = await admin
    .from("market_reservation_standby")
    .select("id")
    .eq("listing_id", parsed.data.listingId)
    .eq("renter_profile_id", user.id)
    .is("promoted_at", null)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return { ok: true, message: "You're already on the standby list — we'll email you the moment it frees up." };
  }

  const { error } = await admin.from("market_reservation_standby").insert({
    listing_id: parsed.data.listingId,
    renter_profile_id: user.id,
    quantity: parsed.data.quantity,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
  });
  if (error) return { ok: false, message: "Couldn't join the list — try again." };

  return {
    ok: true,
    message: "You're on the standby list — first in line gets an email the moment these dates free up.",
  };
}

/** Capacity check for a standby window — true when the requested
 *  quantity now fits (active holds + blocking bookings incl. line
 *  items, mirroring the reserve RPC's math, read-only). */
async function windowAvailable(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  listingId: string,
  startsAt: string,
  endsAt: string,
  quantity: number,
): Promise<boolean> {
  const { data: listing } = await admin
    .from("market_listings")
    .select("quantity, status, prep_buffer_minutes, recovery_buffer_minutes")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || listing.status !== "published") return false;

  const effStart = new Date(
    new Date(startsAt).getTime() - listing.prep_buffer_minutes * 60_000,
  ).toISOString();
  const effEnd = new Date(
    new Date(endsAt).getTime() + listing.recovery_buffer_minutes * 60_000,
  ).toISOString();

  const [{ data: holds }, { data: bookings }, { data: items }] = await Promise.all([
    admin
      .from("market_reservation_holds")
      .select("quantity, expires_at")
      .eq("listing_id", listingId)
      .in("state", ["checkout_hold", "verification_hold", "awaiting_renter_payment", "confirmed"])
      .lt("starts_at", effEnd)
      .gt("ends_at", effStart),
    admin
      .from("market_bookings")
      .select("quantity")
      .eq("listing_id", listingId)
      .in("state", ["confirmed", "ready_for_handoff", "checked_out", "overdue"])
      .lt("starts_at", effEnd)
      .gt("ends_at", effStart),
    admin
      .from("market_booking_items")
      .select("quantity, market_bookings!inner ( state, starts_at, ends_at, listing_id )")
      .eq("listing_id", listingId)
      .in("market_bookings.state", ["confirmed", "ready_for_handoff", "checked_out", "overdue"])
      .neq("market_bookings.listing_id", listingId)
      .lt("market_bookings.starts_at", effEnd)
      .gt("market_bookings.ends_at", effStart),
  ]);

  const now = Date.now();
  const reserved =
    (holds ?? [])
      .filter((h: { expires_at: string | null }) => !h.expires_at || new Date(h.expires_at).getTime() > now)
      .reduce((s: number, h: { quantity: number }) => s + h.quantity, 0) +
    (bookings ?? []).reduce((s: number, b: { quantity: number }) => s + b.quantity, 0) +
    (items ?? []).reduce((s: number, i: { quantity: number }) => s + i.quantity, 0);

  // Conservative: holds + bookings may double-count an active pair, so
  // a "fits" verdict here can under-offer but never over-promises.
  return reserved + quantity <= listing.quantity;
}

/**
 * Offer the freed slot to the queue: first unoffered waiter whose
 * window fits gets a 3h-exclusive email; inside 48h of the start we
 * broadcast to everyone remaining. Fire-and-forget from cancel paths
 * and the hourly cron.
 */
export async function offerStandbyForListing(listingId: string): Promise<void> {
  if (!hasSupabaseEnv()) return;
  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();

  const { data: queue } = await admin
    .from("market_reservation_standby")
    .select("id, renter_profile_id, quantity, starts_at, ends_at, offered_at, offer_expires_at")
    .eq("listing_id", listingId)
    .is("promoted_at", null)
    .order("created_at")
    .limit(20);
  if (!queue || queue.length === 0) return;

  const { data: listing } = await admin
    .from("market_listings")
    .select("title")
    .eq("id", listingId)
    .maybeSingle();
  const title = listing?.title ?? "the item you wanted";

  const now = Date.now();
  // An un-expired exclusive offer is already out — let it run.
  if (queue.some((q) => q.offered_at && q.offer_expires_at && new Date(q.offer_expires_at).getTime() > now)) {
    return;
  }

  for (const waiter of queue) {
    if (waiter.offered_at) continue; // turn already consumed
    if (new Date(waiter.starts_at).getTime() <= now) {
      await admin
        .from("market_reservation_standby")
        .update({ promoted_at: new Date().toISOString() })
        .eq("id", waiter.id);
      continue; // window already started — drop from queue
    }
    if (!(await windowAvailable(admin, listingId, waiter.starts_at, waiter.ends_at, waiter.quantity))) {
      continue; // their window still doesn't fit; maybe a later waiter's does
    }

    const broadcast = new Date(waiter.starts_at).getTime() - now < BROADCAST_WITHIN_MS;
    const expires = new Date(now + OFFER_TTL_MS).toISOString();
    await admin
      .from("market_reservation_standby")
      .update({ offered_at: new Date().toISOString(), offer_expires_at: broadcast ? waiter.starts_at : expires })
      .eq("id", waiter.id);

    const { data: renter } = await admin
      .from("profiles")
      .select("email")
      .eq("id", waiter.renter_profile_id)
      .maybeSingle();
    if (renter?.email) {
      const { notifyMarketEmail } = await import("@/lib/market/notify");
      void notifyMarketEmail({
        kind: "standby_available",
        to: renter.email,
        listingTitle: title,
        startsAt: waiter.starts_at,
        endsAt: waiter.ends_at,
        extra: broadcast
          ? "It's close to the date, so everyone on the list is being notified — first to book gets it."
          : "You're first in line — you have a 3-hour head start before we notify the next person.",
        ctaUrl: `https://rent.korent.app/market/listing/${listingId}`,
      });
    }

    if (!broadcast) return; // sequential: one exclusive offer at a time
  }
}
