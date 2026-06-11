import Link from "next/link";
import { worlds, DEFAULT_METRO_SLUG, metroBySlug } from "@/lib/market/registry";
import { getPublishedListings, getWorldListingCounts } from "@/lib/market/data";
import { ListingCard } from "@/components/market/listing-card";

export const dynamic = "force-dynamic";

/** Popular-category shortcuts shown in the hero — all in the live
 *  world, so every tile lands somewhere bookable. */
const HERO_TILES = [
  { icon: "🎪", label: "Tents & canopies", q: "tent" },
  { icon: "🪑", label: "Tables & chairs", q: "chairs" },
  { icon: "📽️", label: "AV & projectors", q: "projector" },
  { icon: "🔊", label: "Speakers & sound", q: "speaker" },
];

const POPULAR_SEARCHES = ["20x30 tent", "chiavari chairs", "projector", "round tables", "dance floor"];

export default async function MarketHomePage() {
  const metro = metroBySlug.get(DEFAULT_METRO_SLUG)!;
  const [counts, latest] = await Promise.all([
    getWorldListingCounts(DEFAULT_METRO_SLUG),
    getPublishedListings({
      worldSlug: "hosting-and-events",
      metroSlug: DEFAULT_METRO_SLUG,
      limit: 8,
    }),
  ]);

  return (
    <main className="mk-home">
      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="mk-hero">
        <div className="mk-wrap mk-hero-grid">
          <div>
            <span className="mk-eyebrow">● Live in {metro.label}</span>
            <h1>
              Rent expensive things,
              <br />
              only for as long as you need them.
            </h1>
            <p className="mk-sub" style={{ fontSize: 17, maxWidth: 520 }}>
              Tents, event gear, AV and more from verified local sellers —
              deposit-protected, with photo evidence on every rental.
            </p>
            <form className="mk-search lg" action="/market/search" method="get">
              <input
                type="search"
                name="q"
                placeholder="What do you need? Try “20x30 tent”…"
                maxLength={200}
                aria-label="Search marketplace rentals"
              />
              <button type="submit">Search</button>
            </form>
            <div className="mk-chiprow" style={{ marginTop: 14 }}>
              <span className="mk-chiplabel">Popular:</span>
              {POPULAR_SEARCHES.map((q) => (
                <Link key={q} href={`/market/search?q=${encodeURIComponent(q)}`} className="mk-chip">
                  {q}
                </Link>
              ))}
            </div>
          </div>
          <div className="mk-hero-tiles" aria-label="Popular categories">
            {HERO_TILES.map((t) => (
              <Link key={t.label} href={`/market/search?q=${encodeURIComponent(t.q)}`} className="mk-hero-tile">
                <span className="mk-ico" aria-hidden>
                  {t.icon}
                </span>
                <b>{t.label}</b>
                <span>Hosting &amp; Events</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Worlds ────────────────────────────────────────────────── */}
      <section className="mk-wrap mk-section">
        <h2>Browse the worlds</h2>
        <p className="mk-sub">
          Hosting &amp; Events is open now — six more worlds unlock as demand
          arrives. Join a waitlist to vote one forward.
        </p>
        <div className="mk-worlds">
          {worlds.map((w) => (
            <Link key={w.slug} href={`/market/world/${w.slug}`} className="mk-world">
              <span className="mk-ico" aria-hidden>
                {w.icon}
              </span>
              <span className="mk-nm">{w.label}</span>
              {w.status === "live" ? (
                <span className="mk-pill live">
                  ● Live{counts.get(w.slug) ? ` · ${counts.get(w.slug)}` : ""}
                </span>
              ) : (
                <span className="mk-pill soon">Coming soon</span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {latest.length > 0 ? (
        <section className="mk-wrap mk-section">
          <h2>Latest in Hosting &amp; Events</h2>
          <div className="mk-cards">
            {latest.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      ) : null}

      {/* ── How it works ──────────────────────────────────────────── */}
      <section className="mk-band">
        <div className="mk-wrap mk-section">
          <h2>How renting works</h2>
          <div className="mk-steps">
            <div className="mk-step">
              <span className="mk-stepnum">1</span>
              <b>Find it nearby</b>
              <p>
                Browse verified local sellers in {metro.label}. Every listing
                shows real photos, condition and a transparent daily price.
              </p>
            </div>
            <div className="mk-step">
              <span className="mk-stepnum">2</span>
              <b>Book protected</b>
              <p>
                Pay securely on Korent — never off-platform. A risk-based
                deposit (never more than the item&rsquo;s value) authorizes near
                handoff and releases automatically after a clean return.
              </p>
            </div>
            <div className="mk-step">
              <span className="mk-stepnum">3</span>
              <b>Pick up with ID check</b>
              <p>
                The seller verifies your ID at handoff and both sides snap
                photo evidence at pickup and return — so disputes end before
                they start.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust features ────────────────────────────────────────── */}
      <section className="mk-wrap mk-section">
        <div className="mk-features">
          <div className="mk-feature">
            <span className="mk-ico" aria-hidden>
              🛡️
            </span>
            <b>Deposit-protected</b>
            <p>Risk-based holds, never more than the item&rsquo;s value — released automatically within 24h of a clean return.</p>
          </div>
          <div className="mk-feature">
            <span className="mk-ico" aria-hidden>
              📸
            </span>
            <b>Photo evidence</b>
            <p>Both parties document condition at pickup and return. The record lives on the booking.</p>
          </div>
          <div className="mk-feature">
            <span className="mk-ico" aria-hidden>
              ✅
            </span>
            <b>Verified sellers</b>
            <p>Payout identity (KYC) verified through Stripe before anything is bookable. Reviews come only from completed rentals.</p>
          </div>
        </div>
      </section>

      {/* ── Seller band ───────────────────────────────────────────── */}
      <section className="mk-sellerband">
        <div className="mk-wrap mk-sellerband-grid">
          <div>
            <h2>Own event gear? Put it to work.</h2>
            <p>
              List free and pay only when you get booked. Payouts land via
              Stripe, and your store page builds reviews with every rental —
              {" "}{metro.label} renters are already searching.
            </p>
          </div>
          <div className="mk-sellerband-cta">
            <Link href="/market/sell" className="mk-btn">
              Become a seller →
            </Link>
            <span>Free to list · 15% only when booked</span>
          </div>
        </div>
      </section>
    </main>
  );
}
