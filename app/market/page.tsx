import Link from "next/link";
import { worlds, DEFAULT_METRO_SLUG, metroBySlug } from "@/lib/market/registry";
import { getPublishedListings, getWorldListingCounts } from "@/lib/market/data";
import { ListingCard } from "@/components/market/listing-card";
import { DemandRequestForm } from "@/components/market/demand-request-form";
import { HERO_PHOTO, worldPhoto } from "@/lib/market/photos";

export const dynamic = "force-dynamic";

export default async function MarketHomePage() {
  const metro = metroBySlug.get(DEFAULT_METRO_SLUG)!;
  const [counts, latest] = await Promise.all([
    getWorldListingCounts(DEFAULT_METRO_SLUG),
    getPublishedListings({
      worldSlug: "hosting-and-events",
      metroSlug: DEFAULT_METRO_SLUG,
      limit: 6,
    }),
  ]);

  return (
    <main className="mk-home">
      {/* ── Photo hero (mockup: Home) ─────────────────────────────── */}
      <div className="mk-wrap">
        <section className="mk-hero" style={{ backgroundImage: `url(${HERO_PHOTO})` }}>
          <div className="mk-hero-inner">
            <h1>
              Rent expensive things, only for
              <br />
              as long as you need them.
            </h1>
            <form className="mk-search hero" action="/market/search" method="get">
              <input
                type="search"
                name="q"
                placeholder='Try “20x30 tent” or “chiavari chairs”…'
                maxLength={200}
                aria-label="Search marketplace rentals"
              />
              <button type="submit">Search</button>
            </form>
            <div className="mk-hero-badges">
              <span>🛡️ Deposit-backed</span>
              <span>📸 Photo evidence tools</span>
              <span>✅ Identity-verified sellers</span>
              <span>📍 {metro.label}</span>
            </div>
          </div>
        </section>

        {/* ── World mosaic ────────────────────────────────────────── */}
        <h2 className="mk-h2">What do you need this weekend?</h2>
        <div className="mk-mosaic">
          {worlds.map((w, i) => {
            const photo = worldPhoto(w.slug);
            const count = counts.get(w.slug) ?? 0;
            return (
              <Link
                key={w.slug}
                href={`/market/world/${w.slug}`}
                className={`mk-tile${i === 0 ? " big" : ""}`}
                style={photo ? { backgroundImage: `url(${photo})` } : undefined}
              >
                <span className="mk-tile-label">
                  <b>{w.label}</b>
                  {w.status === "live" ? (
                    <small>
                      ● Live{count ? ` · ${count} listing${count === 1 ? "" : "s"}` : " now"}
                    </small>
                  ) : (
                    <small>Coming soon — join waitlist</small>
                  )}
                </span>
              </Link>
            );
          })}
        </div>

        {/* ── Latest listings ─────────────────────────────────────── */}
        {latest.length > 0 ? (
          <>
            <div className="mk-rowhead">
              <h2 className="mk-h2">Latest in Hosting &amp; Events</h2>
              <Link href="/market/world/hosting-and-events" className="mk-more">
                Browse all →
              </Link>
            </div>
            <div className="mk-cards">
              {latest.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </>
        ) : (
          <div className="mk-panel" style={{ marginTop: 8 }}>
            <h2 style={{ margin: "0 0 6px", fontSize: 19 }}>
              Hosting &amp; Events is open in {metro.label}
            </h2>
            <p className="mk-sub" style={{ marginBottom: 12 }}>
              First listings are arriving now. Run an event-rental business?
              List your inventory free and pay only when you get booked.
            </p>
            <Link href="/market/sell" className="mk-btn">
              Become a seller →
            </Link>
          </div>
        )}

        {/* ── How it works (anchor target for footer trust links) ── */}
        <section id="how-it-works" className="mk-section">
          <h2 className="mk-h2">How renting works</h2>
          <div className="mk-steps">
            <div className="mk-step">
              <span className="mk-stepnum">1</span>
              <b>Find it nearby</b>
              <p>
                Browse identity-verified local sellers in {metro.label}. Real
                photos, honest condition notes, transparent daily prices.
              </p>
            </div>
            <div className="mk-step">
              <span className="mk-stepnum">2</span>
              <b>Book protected</b>
              <p>
                Pay securely on Korent — never off-platform. A risk-based
                deposit authorizes near handoff and releases automatically
                after a clean return.
              </p>
            </div>
            <div className="mk-step">
              <span className="mk-stepnum">3</span>
              <b>Pick up with ID check</b>
              <p>
                The seller confirms your ID at handoff, and both sides snap
                photo evidence at pickup and return — disputes end before
                they start.
              </p>
            </div>
          </div>
        </section>

        {/* ── Demand capture (research rule #1: demand is the scarce side) ── */}
        <section className="mk-section">
          <DemandRequestForm
            sourcePage="homepage"
            metroSlug={DEFAULT_METRO_SLUG}
            heading="Looking for something we don't have yet?"
            blurb="Tents, tools, baby gear, trailers, a photographer for your event — tell us what you need in the DMV and we'll notify you when it's available."
          />
        </section>
      </div>
    </main>
  );
}
