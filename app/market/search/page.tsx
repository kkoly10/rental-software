import Link from "next/link";
import type { Metadata } from "next";
import { DEFAULT_METRO_SLUG } from "@/lib/market/registry";
import { getPublishedListings } from "@/lib/market/data";
import { logDemandEvent } from "@/lib/market/actions";
import { ListingCard } from "@/components/market/listing-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Search" };

export default async function MarketSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 200);

  if (query) {
    // Search demand is the strongest §31 graduation signal — log it
    // even (especially) when there are zero results.
    void logDemandEvent({ kind: "search", query, metroSlug: DEFAULT_METRO_SLUG });
  }

  const listings = query
    ? await getPublishedListings({ query, metroSlug: DEFAULT_METRO_SLUG, limit: 30 })
    : [];

  return (
    <main className="mk-wrap">
      <div className="mk-crumb">
        <Link href="/market">Marketplace</Link> · <b>Search</b>
      </div>
      <h1>{query ? `Results for “${query}”` : "Search the marketplace"}</h1>
      <p className="mk-sub">
        {query
          ? `${listings.length} listing${listings.length === 1 ? "" : "s"} near you`
          : "Try “tent”, “chairs”, “projector”…"}
      </p>

      {listings.length > 0 ? (
        <div className="mk-cards">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      ) : query ? (
        <div className="mk-panel">
          <b>Nothing yet for “{query}”.</b>
          <p className="mk-sub" style={{ margin: "8px 0 0" }}>
            We log every search — sellers see what renters want, and new
            categories open where demand shows up. Check back soon.
          </p>
        </div>
      ) : null}
    </main>
  );
}
