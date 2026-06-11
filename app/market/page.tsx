import Link from "next/link";
import { worlds, DEFAULT_METRO_SLUG, metroBySlug } from "@/lib/market/registry";
import { getPublishedListings, getWorldListingCounts } from "@/lib/market/data";
import { ListingCard } from "@/components/market/listing-card";

export const dynamic = "force-dynamic";

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
    <main className="mk-wrap">
      <h1>Rent expensive things, only for as long as you need them.</h1>
      <p className="mk-sub">
        Verified local sellers in {metro.label} · deposit-protected · pickup &
        return photo evidence on every rental
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

      <div className="mk-strip">
        <div>
          🛡️ <b>Deposit-protected</b>&nbsp;— risk-based, never more than the item’s value
        </div>
        <div>
          📸 <b>Photo evidence</b>&nbsp;at pickup & return
        </div>
        <div>
          ✅ <b>Verified sellers</b>&nbsp;— payout KYC before anything is bookable
        </div>
      </div>

      {latest.length > 0 ? (
        <>
          <h2>Latest in Hosting & Events</h2>
          <div className="mk-cards">
            {latest.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </>
      ) : (
        <div className="mk-panel">
          <h2 style={{ marginTop: 0 }}>Hosting & Events is open in {metro.label}</h2>
          <p className="mk-sub" style={{ marginBottom: 12 }}>
            First listings are arriving now. Run an event-rental business?
            List your inventory free and pay only when you get booked.
          </p>
          <Link href="/dashboard/marketplace" className="mk-btn">
            Become a seller →
          </Link>
        </div>
      )}
    </main>
  );
}
