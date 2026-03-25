import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { ProductCard } from "@/components/public/product-card";
import { TrustBar } from "@/components/public/trust-bar";
import { CategoryGrid } from "@/components/public/category-grid";
import { HowItWorks } from "@/components/public/how-it-works";
import { ServiceAreaSection } from "@/components/public/service-area-section";
import { PublicFooter } from "@/components/public/public-footer";
import { getFeaturedCatalogList } from "@/lib/data/catalog-list";
import { getOrganizationSettings } from "@/lib/data/organization-settings";

export default async function HomePage() {
  const [featured, settings] = await Promise.all([
    getFeaturedCatalogList(),
    getOrganizationSettings(),
  ]);

  return (
    <>
      <PublicHeader />

      <main>
        <section className="section public-hero">
          <div className="container">
            <div className="public-hero-shell">
              <div className="public-hero-copy">
                <div className="kicker public-kicker">
                  Clean, delivered inflatable rentals
                </div>
                <h1>Epic Parties Delivered.</h1>
                <p>
                  {settings.websiteMessage} Serving {settings.serviceAreaLabel}.
                  Browse bounce houses, water slides, and packages with a fast
                  reservation flow built for real family events.
                </p>

                <form action="/inventory" className="storefront-search-card">
                  <div className="storefront-search-grid">
                    <label className="storefront-field">
                      <span>Event Date</span>
                      <input name="date" type="date" />
                    </label>

                    <label className="storefront-field">
                      <span>Start Time</span>
                      <input name="start" type="time" />
                    </label>

                    <label className="storefront-field">
                      <span>End Time</span>
                      <input name="end" type="time" />
                    </label>

                    <label className="storefront-field">
                      <span>Delivery ZIP</span>
                      <input
                        name="zip"
                        type="text"
                        placeholder="22554"
                        inputMode="numeric"
                      />
                    </label>

                    <button
                      type="submit"
                      className="primary-btn storefront-search-btn"
                    >
                      Find Available Rentals
                    </button>
                  </div>
                </form>
              </div>

              <div className="public-hero-visual">
                <div className="public-hero-badge">
                  Fully insured • Cleaned between rentals
                </div>

                <div className="public-hero-card">
                  <div className="kicker">Popular for birthdays</div>
                  <h3 style={{ margin: "8px 0 6px" }}>
                    Water slides and bounce houses
                  </h3>
                  <div className="muted">
                    Delivery, setup, safety review, and later pickup handled by
                    our team.
                  </div>

                  <div className="price-row">
                    <strong>Reserve your date fast</strong>
                    <Link href="/inventory" className="secondary-btn">
                      Browse Catalog
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <TrustBar />

        <CategoryGrid />

        <section className="section storefront-section-soft">
          <div className="container">
            <div className="section-header">
              <div>
                <div className="kicker">Featured inventory</div>
                <h2>Popular rentals</h2>
                <div className="muted">
                  Start with the units families book most often for birthdays,
                  school events, and backyard celebrations.
                </div>
              </div>

              <Link href="/inventory" className="ghost-btn">
                Browse all
              </Link>
            </div>

            <div className="grid grid-4">
              {featured.map((product) => (
                <ProductCard
                  key={product.id}
                  name={product.name}
                  slug={product.slug}
                  price={product.price}
                  category={product.category}
                  description={product.description}
                  status={product.status}
                  imageUrl={product.imageUrl}
                />
              ))}
            </div>
          </div>
        </section>

        <div id="how-it-works">
          <HowItWorks />
        </div>

        <div id="service-area">
          <ServiceAreaSection />
        </div>

        <PublicFooter />
      </main>
    </>
  );
}