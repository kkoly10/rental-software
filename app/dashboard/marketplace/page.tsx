import { DashboardShell } from "@/components/layout/dashboard-shell";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getOrgContext } from "@/lib/auth/org-context";
import { worlds, listWorldCategories } from "@/lib/market/registry";
import {
  CreateListingForm,
  SellerProfileForm,
} from "@/components/market/seller-hub-forms";
import { publishListing, pauseListing } from "@/lib/market/seller-actions";

export const dynamic = "force-dynamic";

type ProfileRow = {
  slug: string;
  display_name: string;
  bio: string | null;
  service_radius_miles: number;
  offers_delivery: boolean;
  offers_pickup: boolean;
};

type ListingRow = {
  id: string;
  title: string;
  world_slug: string;
  category_slug: string;
  status: string;
  is_prelist: boolean;
  daily_price_cents: number;
  deposit_cents: number;
};

/**
 * Seller Hub v1 (spec §32): store page + listings manager. Lives in
 * the operator dashboard because Korent operators are the launch
 * supply (build plan M1); marketplace-only seller signup comes later.
 */
export default async function MarketplaceSellerHubPage() {
  const ctx = hasSupabaseEnv() ? await getOrgContext() : null;

  let profile: ProfileRow | null = null;
  let listings: ListingRow[] = [];
  let products: Array<{ id: string; name: string }> = [];

  if (ctx) {
    const supabase = await createSupabaseServerClient();
    const [profileRes, listingsRes, productsRes] = await Promise.all([
      supabase
        .from("market_seller_profiles")
        .select("slug, display_name, bio, service_radius_miles, offers_delivery, offers_pickup")
        .eq("organization_id", ctx.organizationId)
        .maybeSingle(),
      supabase
        .from("market_listings")
        .select("id, title, world_slug, category_slug, status, is_prelist, daily_price_cents, deposit_cents")
        .eq("organization_id", ctx.organizationId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("products")
        .select("id, name")
        .eq("organization_id", ctx.organizationId)
        .order("name")
        .limit(200),
    ]);
    profile = (profileRes.data as ProfileRow | null) ?? null;
    listings = (listingsRes.data as ListingRow[] | null) ?? [];
    products = (productsRes.data as Array<{ id: string; name: string }> | null) ?? [];
  }

  const worldOptions = worlds.map((w) => ({
    slug: w.slug,
    label: w.label,
    status: w.status,
  }));
  const categoryOptions = worlds.flatMap((w) =>
    listWorldCategories(w.slug).map((c) => ({
      worldSlug: w.slug,
      slug: c.slug,
      label: c.label,
    })),
  );

  return (
    <DashboardShell
      title="Marketplace"
      description="Your store page and listings on the Korent marketplace. List free — an 8% operator fee applies only when you get booked."
    >
      <div
        className="dashboard-grid"
        style={{ gridTemplateColumns: "1.4fr 1fr", alignItems: "start" }}
      >
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Seller Hub</div>
              <h2 style={{ margin: "6px 0 0" }}>Your listings</h2>
            </div>
          </div>

          {listings.length === 0 ? (
            <div className="order-card" style={{ textAlign: "center", padding: "32px 16px" }}>
              <strong>No listings yet.</strong>
              <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                Create your store page, then add your first listing. Hosting &
                Events is live in the DMV — other worlds take pre-listings.
              </div>
            </div>
          ) : (
            <div className="list">
              {listings.map((l) => (
                <article key={l.id} className="order-card">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <strong>{l.title}</strong>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {l.world_slug} / {l.category_slug} · $
                        {(l.daily_price_cents / 100).toFixed(0)}/day · deposit $
                        {(l.deposit_cents / 100).toFixed(0)}
                        {l.is_prelist ? " · pre-list (not bookable until world opens)" : ""}
                      </div>
                      <span
                        className={`badge ${l.status === "published" ? "success" : ""}`}
                        style={{ marginTop: 6 }}
                      >
                        {l.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {l.status !== "published" ? (
                        <form action={publishListing}>
                          <input type="hidden" name="listing_id" value={l.id} />
                          <button type="submit" className="primary-btn" style={{ fontSize: 13 }}>
                            Publish
                          </button>
                        </form>
                      ) : (
                        <form action={pauseListing}>
                          <input type="hidden" name="listing_id" value={l.id} />
                          <button type="submit" className="secondary-btn" style={{ fontSize: 13 }}>
                            Pause
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <CreateListingForm
              worlds={worldOptions}
              categories={categoryOptions}
              products={products}
            />
          </div>
        </section>

        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Store page</div>
              <h2 style={{ margin: "6px 0 0" }}>
                {profile ? `/store/${profile.slug}` : "Create your store page"}
              </h2>
            </div>
          </div>
          <SellerProfileForm
            profile={
              profile
                ? {
                    slug: profile.slug,
                    displayName: profile.display_name,
                    bio: profile.bio,
                    serviceRadiusMiles: profile.service_radius_miles,
                    offersDelivery: profile.offers_delivery,
                    offersPickup: profile.offers_pickup,
                  }
                : null
            }
          />
          <div className="muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.5 }}>
            Your store page lives <b>inside</b> the marketplace at
            rent.korent.app/store/your-url — it is not a separate website, and
            it never links off-platform. Your white-label storefront website
            (your subdomain) is unchanged and separate.
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
