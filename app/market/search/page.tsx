import Link from "next/link";
import type { Metadata } from "next";
import { DEFAULT_METRO_SLUG } from "@/lib/market/registry";
import { getPublishedListings } from "@/lib/market/data";
import { logDemandEvent } from "@/lib/market/actions";
import { ListingCard } from "@/components/market/listing-card";
import { DemandRequestForm } from "@/components/market/demand-request-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Search" };

export default async function MarketSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 200);

  const listings = query
    ? await getPublishedListings({ query, metroSlug: DEFAULT_METRO_SLUG, limit: 30 })
    : [];

  if (query) {
    // Search demand is the strongest graduation signal — log it even
    // (especially) when there are zero results. result_count makes a
    // zero-result search distinguishable downstream.
    void logDemandEvent({
      kind: "search",
      query,
      metroSlug: DEFAULT_METRO_SLUG,
      resultCount: listings.length,
    });
  }

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
        <div style={{ marginTop: 16 }}>
          <DemandRequestForm
            sourcePage={`search:${query}`}
            metroSlug={DEFAULT_METRO_SLUG}
            defaultQuery={query}
            heading={`Nothing yet for “${query}”.`}
            blurb="We log every search, and new categories open where demand shows up. Leave your email and we'll reach out the moment a local seller lists this."
          />
        </div>
      ) : null}
    </main>
  );
}
