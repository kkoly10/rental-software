import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getWorld,
  listWorldCategories,
  DEFAULT_METRO_SLUG,
  metroBySlug,
  graduationGates,
} from "@/lib/market/registry";
import { getPublishedListings } from "@/lib/market/data";
import { logDemandEvent } from "@/lib/market/actions";
import { ListingCard } from "@/components/market/listing-card";
import { WaitlistForm } from "@/components/market/waitlist-form";
import { worldPhoto } from "@/lib/market/photos";

export const dynamic = "force-dynamic";

type Params = { world: string };
type SearchParams = { category?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { world: worldSlug } = await params;
  const world = getWorld(worldSlug);
  if (!world) return {};
  return {
    title: world.label,
    description: world.tagline,
  };
}

export default async function WorldPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { world: worldSlug } = await params;
  const { category: activeCategory } = await searchParams;
  const world = getWorld(worldSlug);
  if (!world) notFound();

  const metro = metroBySlug.get(DEFAULT_METRO_SLUG)!;
  const categories = listWorldCategories(world.slug);

  // Demand telemetry feeds the §31 graduation gates.
  void logDemandEvent({
    kind: activeCategory ? "category_view" : "world_view",
    worldSlug: world.slug,
    categorySlug: activeCategory,
    metroSlug: metro.slug,
  });

  const listings = await getPublishedListings({
    worldSlug: world.slug,
    categorySlug: activeCategory,
    metroSlug: metro.slug,
    limit: 30,
  });

  if (world.status === "smoke_test") {
    return (
      <main className="mk-wrap">
        <div className="mk-hero-soon">
          <div className="mk-big" aria-hidden>
            {world.icon}
          </div>
          <h1>
            {world.label} is coming to {metro.label}
          </h1>
          <p className="mk-sub">{world.tagline} — from verified local sellers, deposit-protected.</p>
          <WaitlistForm worldSlug={world.slug} metroSlug={metro.slug} />
          <p className="mk-card-m">
            Launches when {graduationGates.minSellerPrelistings} local sellers have listed.
            Have gear? Pre-list it free from your{" "}
            <Link href="/dashboard/marketplace">seller hub</Link>.
          </p>
        </div>

        {listings.length > 0 ? (
          <>
            <h2 style={{ textAlign: "center" }}>A preview of what’s coming</h2>
            <div className="mk-cards" style={{ opacity: 0.65 }}>
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </>
        ) : null}
      </main>
    );
  }

  const photo = worldPhoto(world.slug);
  return (
    <main className="mk-wrap">
      <div className="mk-crumb">
        <Link href="/market">Marketplace</Link> · <b>{world.label}</b>
        {activeCategory ? <> · {activeCategory}</> : null}
      </div>
      <div
        className="mk-banner"
        style={photo ? { backgroundImage: `url(${photo})` } : undefined}
      >
        <div className="mk-banner-inner">
          <div className="mk-kicker">Marketplace · {metro.label}</div>
          <h1>{world.label}</h1>
          <p>{world.tagline}</p>
          <span className="mk-pill live" style={{ background: "rgba(255,255,255,0.92)" }}>
            ● Live · {listings.length} listing{listings.length === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <div className="mk-chiprow">
        <Link
          href={`/market/world/${world.slug}`}
          className={`mk-chip${!activeCategory ? " on" : ""}`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/market/world/${world.slug}?category=${c.slug}`}
            className={`mk-chip${activeCategory === c.slug ? " on" : ""}`}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {listings.length > 0 ? (
        <div className="mk-cards">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      ) : (
        <div className="mk-panel">
          <b>No listings here yet.</b>
          <p className="mk-sub" style={{ margin: "8px 0 12px" }}>
            Sellers are onboarding in {metro.label} now. Have inventory in this
            category? List it free — you pay only when you get booked.
          </p>
          <Link href="/dashboard/marketplace" className="mk-btn ghost">
            Become a seller →
          </Link>
        </div>
      )}
    </main>
  );
}
