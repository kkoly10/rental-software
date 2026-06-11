import Link from "next/link";
import type { Metadata } from "next";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { payForBooking } from "@/lib/market/payment-actions";
import {
  RenterCancelButton,
  SellerNoShowButton,
} from "@/components/market/cancel-buttons";
import { EvidenceForm } from "@/components/market/evidence-form";
import { DisputeForm } from "@/components/market/dispute-form";
import { ReviewForm } from "@/components/market/review-form";
import { FollowupForm } from "@/components/market/followup-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My rentals" };

type BookingRow = {
  id: string;
  state: string;
  starts_at: string;
  ends_at: string;
  quantity: number;
  subtotal_cents: number;
  deposit_cents: number;
  created_at: string;
  market_listings: { title: string; photo_url: string | null } | null;
};

const STATE_LABELS: Record<string, { label: string; tone: "ok" | "warn" | "muted" }> = {
  pending_seller_approval: { label: "Awaiting seller (24h)", tone: "warn" },
  awaiting_payment: { label: "Approved — pay to confirm", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "ok" },
  ready_for_handoff: { label: "Ready for handoff", tone: "ok" },
  checked_out: { label: "Active rental", tone: "ok" },
  overdue: { label: "Overdue", tone: "warn" },
  returned_pending_review: { label: "Returned — pending review", tone: "muted" },
  completed: { label: "Completed", tone: "muted" },
  cancelled: { label: "Cancelled", tone: "muted" },
  disputed: { label: "In dispute", tone: "warn" },
};

/**
 * Renter account surface: every booking with its state and the action
 * that state needs (pay / cancel). Reads via the renter's own RLS
 * policy — no admin client in the render path.
 */
export default async function MyRentalsPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const { paid } = await searchParams;

  let bookings: BookingRow[] = [];
  let signedIn = false;
  let followedUp = new Set<string>();

  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
    if (user) {
      const { data } = await supabase
        .from("market_bookings")
        .select(
          "id, state, starts_at, ends_at, quantity, subtotal_cents, deposit_cents, created_at, market_listings ( title, photo_url )",
        )
        .eq("renter_profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      bookings = (data as unknown as BookingRow[] | null) ?? [];
      const completedIds = bookings.filter((b) => b.state === "completed").map((b) => b.id);
      if (completedIds.length > 0) {
        const { data: fu } = await supabase
          .from("market_followups")
          .select("booking_id")
          .eq("party", "renter")
          .in("booking_id", completedIds);
        followedUp = new Set((fu ?? []).map((f) => f.booking_id));
      }
    }
  }

  if (!signedIn) {
    return (
      <main className="mk-wrap">
        <h1>My rentals</h1>
        <p className="mk-sub">Sign in to see your bookings and requests.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a className="mk-btn" href={`/market/login?redirect=${encodeURIComponent("/market/rentals")}`}>
            Sign in
          </a>
          <Link className="mk-btn ghost" href="/market/join">
            Create a renter account
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mk-wrap">
      <h1>My rentals</h1>
      <p className="mk-sub">Every request, booking and payment in one place.</p>

      {paid ? (
        <p className="mk-msg ok" style={{ marginBottom: 16 }}>
          ✓ Payment received — your booking is confirmed (it may take a few
          seconds to update below).
        </p>
      ) : null}

      {bookings.length === 0 ? (
        <div className="mk-panel">
          <b>No rentals yet.</b>
          <p className="mk-sub" style={{ margin: "8px 0 12px" }}>
            Browse Hosting & Events and send your first request — you pay
            nothing unless the seller accepts.
          </p>
          <Link href="/market/world/hosting-and-events" className="mk-btn ghost">
            Browse rentals →
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {bookings.map((b) => {
            const meta = STATE_LABELS[b.state] ?? { label: b.state, tone: "muted" as const };
            return (
              <div key={b.id} className="mk-panel" style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <b>{b.market_listings?.title ?? "Listing"}</b>
                  <div className="mk-card-m">
                    {new Date(b.starts_at).toLocaleDateString()} →{" "}
                    {new Date(b.ends_at).toLocaleDateString()} · qty {b.quantity} · $
                    {(b.subtotal_cents / 100).toFixed(0)}
                    {b.deposit_cents > 0
                      ? ` · deposit $${(b.deposit_cents / 100).toFixed(0)} at handoff`
                      : ""}
                  </div>
                  <span className={`mk-badge ${meta.tone === "ok" ? "v" : "soon"}`} style={{ marginTop: 6 }}>
                    {meta.label}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {b.state === "awaiting_payment" ? (
                    <form action={payForBooking}>
                      <input type="hidden" name="booking_id" value={b.id} />
                      <button type="submit" className="mk-btn">
                        Pay ${(b.subtotal_cents / 100).toFixed(0)} now
                      </button>
                    </form>
                  ) : null}
                  {["pending_seller_approval", "awaiting_payment", "confirmed", "ready_for_handoff"].includes(b.state) ? (
                    <RenterCancelButton bookingId={b.id} />
                  ) : null}
                  {["confirmed", "ready_for_handoff"].includes(b.state) &&
                  new Date(b.starts_at).getTime() + 30 * 60 * 1000 < Date.now() ? (
                    <SellerNoShowButton bookingId={b.id} />
                  ) : null}
                </div>
                {b.state === "ready_for_handoff" || b.state === "checked_out" ? (
                  <div style={{ width: "100%" }}>
                    <EvidenceForm bookingId={b.id} phase="handoff" />
                  </div>
                ) : null}
                {["checked_out", "overdue", "returned_pending_review"].includes(b.state) ? (
                  <div style={{ width: "100%" }}>
                    <EvidenceForm bookingId={b.id} phase="return" />
                    <DisputeForm bookingId={b.id} />
                  </div>
                ) : null}
                {b.state === "completed" ? (
                  <div style={{ width: "100%" }}>
                    <ReviewForm bookingId={b.id} />
                    {!followedUp.has(b.id) ? (
                      <FollowupForm bookingId={b.id} party="renter" />
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
