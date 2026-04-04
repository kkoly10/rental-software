import Link from "next/link";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCatalogDetail } from "@/lib/data/catalog-detail";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { DemoBanner } from "@/components/demo/demo-banner";
import { isCurrentTenantDemo } from "@/lib/demo/context";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { productJsonLd } from "@/lib/seo/json-ld";
import { JsonLdScript } from "@/components/seo/json-ld-script";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [product, settings] = await Promise.all([
    getCatalogDetail(slug),
    getOrganizationSettings(),
  ]);

  return buildPageMetadata({
    title: `${product.name} | ${settings.businessName}`,
    description: product.description,
    path: `/inventory/${product.slug}`,
    image: product.imageUrl || undefined,
  });
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ date?: string; zip?: string }>;
}) {
  await requirePublicOrg();
  const isDemo = await isCurrentTenantDemo();

  const { slug } = await params;
  const { date, zip } = await searchParams;
  const product = await getCatalogDetail(slug);

  const checkoutParams = new URLSearchParams();
  checkoutParams.set("product", product.slug);
  if (date) checkoutParams.set("date", date);
  if (zip) checkoutParams.set("zip", zip);

  const galleryImages =
    product.galleryImages && product.galleryImages.length > 0
      ? product.galleryImages
      : ["", "", "", ""];

  const jsonLd = productJsonLd({
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: product.price,
    category: product.category,
    imageUrl: product.imageUrl,
    status: "Available",
  });

  return (
    <>
      <PublicHeader />
      <JsonLdScript data={jsonLd} />

      <main className="page">
        <div className="container">
          <div className="storefront-context-pills" style={{ marginBottom: 18 }}>
            {date ? (
              <span className="storefront-context-pill">Date: {date}</span>
            ) : null}
            {zip ? <span className="storefront-context-pill">ZIP: {zip}</span> : null}
          </div>

          <div className="storefront-detail-shell">
            <section className="panel storefront-gallery">
              <div
                className="storefront-gallery-main"
                style={
                  product.imageUrl
                    ? {
                        backgroundImage: `url(${product.imageUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              />
              <div className="storefront-thumb-grid">
                {galleryImages.slice(0, 4).map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className="storefront-thumb"
                    style={
                      image
                        ? {
                            backgroundImage: `url(${image})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            </section>

            <aside className="panel storefront-summary-card">
              <div className="price-row" style={{ marginTop: 0 }}>
                <div className="kicker">{product.category}</div>
                <StatusBadge label="Available" tone="success" />
              </div>

              <h1 style={{ margin: "10px 0 8px" }}>{product.name}</h1>
              <p className="muted">{product.description}</p>

              <div className="price-row" style={{ marginTop: 18 }}>
                <strong style={{ fontSize: "2rem" }}>{product.price}</strong>
                <span className="badge">Deposit reserves date</span>
              </div>

              <div className="storefront-highlight-list">
                {product.highlights.map((highlight) => (
                  <div key={highlight} className="order-card">
                    {highlight}
                  </div>
                ))}
              </div>

              <div className="price-row" style={{ marginTop: 20 }}>
                <Link
                  href={`/checkout?${checkoutParams.toString()}`}
                  className="primary-btn"
                >
                  Reserve Now
                </Link>
                <Link href="/inventory" className="secondary-btn">
                  Back
                </Link>
              </div>
            </aside>
          </div>

          <section className="section storefront-detail-section">
            <div className="storefront-detail-grid">
              <div className="panel">
                <div className="kicker">What to expect</div>
                <h2 style={{ margin: "8px 0 10px" }}>
                  Delivered like a real service, not just a product
                </h2>
                <div className="list">
                  <div className="order-card">
                    <strong>Professional setup</strong>
                    <div className="muted" style={{ marginTop: 6 }}>
                      Our team delivers, positions, anchors, and reviews the
                      basic safety setup before leaving.
                    </div>
                  </div>
                  <div className="order-card">
                    <strong>Clear area required</strong>
                    <div className="muted" style={{ marginTop: 6 }}>
                      Flat open space and access to power or a generator keeps
                      setup smooth on event day.
                    </div>
                  </div>
                  <div className="order-card">
                    <strong>Pickup handled later</strong>
                    <div className="muted" style={{ marginTop: 6 }}>
                      After the party, we return for pack-down so you can focus
                      on the event, not logistics.
                    </div>
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="kicker">Best fit</div>
                <h2 style={{ margin: "8px 0 10px" }}>Great for family events</h2>
                <div className="list">
                  <div className="order-card">Backyard birthdays</div>
                  <div className="order-card">School or church family days</div>
                  <div className="order-card">
                    Weekend neighborhood celebrations
                  </div>
                  <div className="order-card">
                    Add-ons and package bundles available
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <PublicFooter />
      {isDemo && <DemoBanner />}
    </>
  );
}