import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { ProductCard } from "@/components/public/product-card";
import { getFeaturedCatalogList } from "@/lib/data/catalog-list";

export default async function HomePage() {
  const featured = await getFeaturedCatalogList();

  return (
    <>
      <PublicHeader />
      <main>
        <section className="hero">
          <div className="container">
            <div className="hero-panel">
              <div>
                <div className="kicker" style={{ color: "white" }}>
                  Inflatable rental software
                </div>
                <h1>Book fun faster. Run operations from one place.</h1>
                <p>
                  Web-first rental software for inflatable companies today,
                  built to expand into party rental and trailer workflows later.
                </p>
                <div className="search-bar">
                  <input defaultValue="May 24, 2026" aria-label="Date" />
                  <input defaultValue="22554" aria-label="ZIP code" />
                  <select defaultValue="Inflatables" aria-label="Category">
                    <option>Inflatables</option>
                    <option>Water Slides</option>
                    <option>Obstacle Courses</option>
                    <option>Add-ons</option>
                  </select>
                  <Link
                    href="/inventory"
                    className="primary-btn"
                    style={{ textAlign: "center" }}
                  >
                    Find Rentals
                  </Link>
                </div>
              </div>

              <div className="surface-card" style={{ padding: 22 }}>
                <div className="kicker">Launch stack</div>
                <div className="list" style={{ marginTop: 10 }}>
                  <div className="order-card">
                    Live availability and conflict blocking
                  </div>
                  <div className="order-card">
                    Deposits, waivers, and checkout flow
                  </div>
                  <div className="order-card">
                    Delivery board with stop statuses
                  </div>
                  <div className="order-card">
                    Future-ready for party and trailer modes
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-header">
              <div>
                <div className="kicker">Featured inventory</div>
                <h2>Popular rentals</h2>
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
                />
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}