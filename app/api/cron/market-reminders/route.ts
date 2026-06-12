import { NextRequest, NextResponse } from "next/server";
import { hasSupabaseServiceRoleEnv } from "@/lib/supabase/admin";
import { verifyCronSecret } from "@/lib/security/cron-auth";

export const maxDuration = 60;

/**
 * Roadmap item 3 (master plan §24): time-based lifecycle reminders.
 * Hourly. Three windows, each exactly-once via a claim UPDATE on the
 * booking's sent-at flag — a crashed run can't double-send, a second
 * runner loses the claim race harmlessly.
 *
 *  - pickup_reminder:  confirmed/ready_for_handoff, starts in 18–30h
 *  - return_reminder:  checked_out, due within the next 12h
 *  - return_due_nudge: checked_out, past due but inside the 2h grace
 *    window (after that, the cleanup cron flips to overdue and the
 *    overdue email takes over)
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseServiceRoleEnv()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const { createSupabaseAdminClient } = await import("@/lib/supabase/server");
  const admin = createSupabaseAdminClient();
  const { getBookingPartyEmails, notifyMarketEmail } = await import("@/lib/market/notify");

  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const counts = { pickup: 0, return: 0, nudge: 0 };

  type Slot = {
    key: "pickup" | "return" | "nudge";
    flag: string;
    kind: "pickup_reminder" | "return_reminder" | "return_due_nudge";
    states: string[];
    timeColumn: "starts_at" | "ends_at";
    from: string;
    to: string;
  };
  const slots: Slot[] = [
    {
      key: "pickup",
      flag: "pickup_reminder_sent_at",
      kind: "pickup_reminder",
      states: ["confirmed", "ready_for_handoff"],
      timeColumn: "starts_at",
      from: iso(now + 18 * 3600_000),
      to: iso(now + 30 * 3600_000),
    },
    {
      key: "return",
      flag: "return_reminder_sent_at",
      kind: "return_reminder",
      states: ["checked_out"],
      timeColumn: "ends_at",
      from: iso(now),
      to: iso(now + 12 * 3600_000),
    },
    {
      key: "nudge",
      flag: "return_due_nudge_sent_at",
      kind: "return_due_nudge",
      states: ["checked_out"],
      timeColumn: "ends_at",
      from: iso(now - 2 * 3600_000),
      to: iso(now),
    },
  ];

  for (const slot of slots) {
    const { data: candidates } = await admin
      .from("market_bookings")
      .select("id")
      .in("state", slot.states)
      .is(slot.flag, null)
      .gte(slot.timeColumn, slot.from)
      .lte(slot.timeColumn, slot.to)
      .limit(50);

    for (const c of candidates ?? []) {
      // Claim first: only the row that flips null→now sends.
      const { data: claimed } = await admin
        .from("market_bookings")
        .update({ [slot.flag]: new Date().toISOString() })
        .eq("id", c.id)
        .is(slot.flag, null)
        .select("id")
        .maybeSingle();
      if (!claimed) continue;

      const party = await getBookingPartyEmails(c.id);
      if (!party?.renterEmail) continue;
      await notifyMarketEmail({
        kind: slot.kind,
        to: party.renterEmail,
        listingTitle: party.listingTitle,
        startsAt: party.startsAt,
        endsAt: party.endsAt,
      });
      counts[slot.key] += 1;
    }
  }

  // Roadmap item 4: pending extension requests lapse after the 12h
  // window — original terms stand, renter notified (Turo model).
  let lapsed = 0;
  const { data: expired } = await admin
    .from("market_extension_requests")
    .select("id, booking_id")
    .eq("state", "pending")
    .lte("expires_at", new Date().toISOString())
    .limit(50);
  for (const e of expired ?? []) {
    const { data: claimed } = await admin
      .from("market_extension_requests")
      .update({ state: "lapsed", decided_at: new Date().toISOString() })
      .eq("id", e.id)
      .eq("state", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    lapsed += 1;
    const party = await getBookingPartyEmails(e.booking_id);
    if (party?.renterEmail) {
      await notifyMarketEmail({
        kind: "extension_lapsed",
        to: party.renterEmail,
        listingTitle: party.listingTitle,
        startsAt: party.startsAt,
        endsAt: party.endsAt,
      });
    }
  }

  // Roadmap item 6: standby cascade — consume expired exclusive offers
  // and hand the turn to the next waiter; also periodically re-offer
  // listings whose capacity freed via TTL expiry (no cancel hook ran).
  let standbyOffers = 0;
  const { data: expiredOffers } = await admin
    .from("market_reservation_standby")
    .select("id, listing_id")
    .is("promoted_at", null)
    .not("offered_at", "is", null)
    .lte("offer_expires_at", new Date().toISOString())
    .limit(50);
  const cascadeListings = new Set<string>();
  for (const o of expiredOffers ?? []) {
    await admin
      .from("market_reservation_standby")
      .update({ promoted_at: new Date().toISOString() })
      .eq("id", o.id)
      .is("promoted_at", null);
    cascadeListings.add(o.listing_id);
  }
  // Listings with unoffered waiters get a periodic availability check
  // (covers holds that expired by TTL without a cancellation event).
  const { data: waiting } = await admin
    .from("market_reservation_standby")
    .select("listing_id")
    .is("promoted_at", null)
    .is("offered_at", null)
    .limit(100);
  for (const w of waiting ?? []) cascadeListings.add(w.listing_id);
  if (cascadeListings.size > 0) {
    const { offerStandbyForListing } = await import("@/lib/market/standby-actions");
    for (const id of cascadeListings) {
      await offerStandbyForListing(id);
      standbyOffers += 1;
    }
  }

  // Registry hygiene: re-file listings whose stored category drifted
  // from the code registry (served with fallback defaults until then).
  // No-op unless ANTHROPIC_API_KEY is configured.
  let categoriesFixed = 0;
  try {
    const { fixUnknownCategories } = await import("@/lib/market/category-fixer");
    categoriesFixed = (await fixUnknownCategories()).fixed;
  } catch (err) {
    console.error("market-reminders: category fixer failed", err);
  }

  return NextResponse.json({
    ok: true,
    ...counts,
    lapsed,
    standbyListingsChecked: standbyOffers,
    categoriesFixed,
  });
}
