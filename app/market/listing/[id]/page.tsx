import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getListingById } from "@/lib/market/data";
import {
  getCategory,
  getWorld,
  resolveOperatingDefaults,
} from "@/lib/market/registry";
import { logDemandEvent } from "@/lib/market/actions";
import {
  cancellationPresetForFamily,
  LATE_FLAT_FEE_CENTS,
  LATE_DAYS_CAP,
  LATE_GRACE_MS,
} from "@/lib/market/cancellation";
import { categoryIcon } from "@/lib/market/icons";
import { sellerBookable } from "@/lib/market/bookability";
import { BookingRequestForm } from "@/components/market/booking-request-form";
import { MessageForm } from "@/components/market/message-form";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Params = { id: string };

function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  })}`;
}

function hours(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} hr` : `${minutes} min`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListingById(id);
  if (!listing) return {};
  return { title: listing.title };
}

export default async function ListingPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const listing = await getListingById(id);
  if (!listing) notFound();

  const world = getWorld(listing.worldSlug);
  const category = getCategory(listing.worldSlug, listing.categorySlug);
  const defaults = resolveOperatingDefaults(listing.worldSlug, listing.categorySlug);

  void logDemandEvent({
    kind: "listing_view",
    worldSlug: listing.worldSlug,
    categorySlug: listing.categorySlug,
    metroSlug: listing.metroSlug,
    listingId: listing.id,
  });

  // §12 gate: a listing only takes bookings when the seller's payout
  // account is verified — otherwise we keep the page visible and swap
  // the CTA (roadmap item 1).
  const bookable = await sellerBookable(listing.organizationId);

  // Roadmap item 5: other published listings from the same seller for
  // the "add more from this seller" picker (one booking, line items).
  const { getSellerListings } = await import("@/lib/market/data");
  const sellerExtras = (await getSellerListings(listing.organizationId))
    .filter((l) => l.id !== listing.id && !l.isPrelist)
    .slice(0, 6)
    .map((l) => ({
      id: l.id,
      title: l.title,
      dailyPriceCents: l.dailyPriceCents,
      maxQuantity: l.quantity,
    }));

  let signedIn = false;
  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    signedIn = Boolean(user);
  }

  return (
    <main className="mk-wrap">
      <div className="mk-crumb">
        <Link href="/market">Marketplace</Link> ·{" "}
        <Link href={`/market/world/${listing.worldSlug}`}>{world?.label}</Link> ·{" "}
        <b>{listing.title}</b>
      </div>

      <div className="mk-pdp">
        <div>
          <div className="mk-gallery">
            {listing.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.photoUrl} alt={listing.title} />
            ) : (
              <span aria-hidden>{categoryIcon(listing.worldSlug, listing.categorySlug)}</span>
            )}
          </div>
          <h1 style={{ marginTop: 18 }}>{listing.title}</h1>
          <p className="mk-card-m" style={{ fontSize: 14 }}>
            {listing.sellerDisplayName ?? "Local seller"}
            {listing.sellerSlug ? (
              <>
                {" · "}
                <Link href={`/market/store/${listing.sellerSlug}`}>view store</Link>
              </>
            ) : null}
            {category ? ` · ${category.label}` : null}
          </p>

          {listing.description ? (
            <p className="mk-sub" style={{ marginTop: 14 }}>
              {listing.description}
            </p>
          ) : null}

          <div className="mk-specs">
            <div>
              <b>Condition</b> {listing.condition}
            </div>
            {listing.proofVideoUrl ? (
              <div>
                <b>Proof of function</b> seller-provided demo ·{" "}
                <a href={listing.proofVideoUrl} target="_blank" rel="noreferrer">
                  watch video
                </a>
              </div>
            ) : null}
            <div>
              <b>Fulfillment</b>{" "}
              {[
                listing.offersDelivery ? "Delivery" : null,
                listing.offersPickup ? "Pickup" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Pickup"}
            </div>
            <div>
              <b>Turnaround</b> {hours(defaults.prepBufferMinutes)} prep before ·{" "}
              {hours(defaults.recoveryBufferMinutes)} recovery after
            </div>
            {listing.inventoryMode === "quantity" ? (
              <div>
                <b>Available</b> up to {listing.quantity} units
              </div>
            ) : null}
          </div>
        </div>

        <div className="mk-panel">
          <div className="mk-price">
            {dollars(listing.dailyPriceCents)} <small>/ day</small>
          </div>
          {listing.weekendPriceCents || listing.weeklyPriceCents ? (
            <p className="mk-card-m" style={{ marginTop: 4 }}>
              {listing.weekendPriceCents
                ? `${dollars(listing.weekendPriceCents)} weekend`
                : null}
              {listing.weekendPriceCents && listing.weeklyPriceCents ? " · " : null}
              {listing.weeklyPriceCents ? `${dollars(listing.weeklyPriceCents)} weekly` : null}
            </p>
          ) : null}

          {listing.isPrelist ? (
            <>
              <p className="mk-note warn" style={{ marginTop: 14 }}>
                ⏳ <b>Pre-listing.</b> {world?.label} isn’t bookable in this metro
                yet — join the waitlist on the{" "}
                <Link href={`/market/world/${listing.worldSlug}`}>world page</Link>{" "}
                and we’ll email you at launch.
              </p>
              <button className="mk-btn" style={{ width: "100%", marginTop: 12 }} disabled>
                Booking opens at launch
              </button>
            </>
          ) : (
            <>
              {!bookable ? (
                <>
                  <p className="mk-note warn" style={{ marginTop: 14 }}>
                    ⏳ <b>This seller is finishing payout setup.</b> Booking
                    opens as soon as it&rsquo;s verified — usually within a
                    day. You can message them in the meantime.
                  </p>
                  <button className="mk-btn" style={{ width: "100%", marginTop: 12 }} disabled>
                    Booking opens after seller verification
                  </button>
                </>
              ) : signedIn ? (
                <BookingRequestForm
                  listingId={listing.id}
                  maxQuantity={listing.quantity}
                  instant={listing.instantBook}
                  sellerExtras={sellerExtras}
                />
              ) : (
                <>
                  <a
                    className="mk-btn"
                    style={{ width: "100%", marginTop: 14, textAlign: "center", boxSizing: "border-box" }}
                    href={`/market/login?redirect=${encodeURIComponent(`/market/listing/${listing.id}`)}`}
                  >
                    Sign in to request a booking
                  </a>
                  <p className="mk-card-m" style={{ textAlign: "center", marginTop: 8 }}>
                    New here? <Link href="/market/join">Create a free renter account</Link>
                  </p>
                </>
              )}
              <p className="mk-note">
                🛡️ <b>Deposit: {dollars(listing.depositCents)}</b> — authorized
                (not charged) close to handoff, released after clean return.
                You’ll never deposit more than the item is worth.
              </p>
              <p className="mk-note warn">
                ⏱️ Sellers respond within 24 hours or your request auto-cancels
                and you pay nothing.
              </p>
              <p className="mk-note">
                📸 <b>Photos protect both sides:</b> the seller photographs the
                item&rsquo;s condition before handoff, and you photograph it at
                pickup and at return. Snapping a few quick pickup photos is your
                proof against being blamed for damage you didn&rsquo;t cause.
              </p>
              <p className="mk-note">
                ⏰ <b>Late returns:</b> after a {LATE_GRACE_MS / 3_600_000}-hour
                grace window, each started late day costs the daily rate plus a
                ${LATE_FLAT_FEE_CENTS / 100} late fee, for up to {LATE_DAYS_CAP}{" "}
                days — then the rental is treated as a non-return. Need more
                time? Request an extension in My rentals before the return time
                and no late fees accrue while it&rsquo;s pending.
              </p>
              <p className="mk-note">
                ↩️ <b>Cancellation ({cancellationPresetForFamily(listing.riskFamilySlug).name}):</b>{" "}
                full refund until{" "}
                {cancellationPresetForFamily(listing.riskFamilySlug).fullRefundHoursBefore >= 48
                  ? `${cancellationPresetForFamily(listing.riskFamilySlug).fullRefundHoursBefore / 24} days`
                  : `${cancellationPresetForFamily(listing.riskFamilySlug).fullRefundHoursBefore} hours`}{" "}
                before handoff, 50% after that, plus a 1-hour free window right
                after booking. Deposits are always fully released on cancellation.
              </p>
              {signedIn ? (
                <>
                  <div style={{ borderTop: "1px dashed var(--mk-line)", marginTop: 14, paddingTop: 4 }} />
                  <MessageForm listingId={listing.id} placeholder="💬 Message the seller…" />
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
