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
              <span aria-hidden>{world?.icon ?? "📦"}</span>
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
              {signedIn ? (
                <BookingRequestForm listingId={listing.id} maxQuantity={listing.quantity} />
              ) : (
                <a
                  className="mk-btn"
                  style={{ width: "100%", marginTop: 14, textAlign: "center", boxSizing: "border-box" }}
                  href={`/login?redirect=${encodeURIComponent(`/market/listing/${listing.id}`)}`}
                >
                  Sign in to request a booking
                </a>
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
