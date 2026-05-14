import Link from "next/link";
import type { Metadata } from "next";
import { getPlaceholderImage } from "@/lib/utils/placeholders";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCatalogDetail } from "@/lib/data/catalog-detail";
import { enrichCatalogAvailability } from "@/lib/data/catalog-availability";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { DemoBanner } from "@/components/demo/demo-banner";
import { isCurrentTenantDemo } from "@/lib/demo/context";
import { buildPageMetadata, getRequestOrigin } from "@/lib/seo/metadata";
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

  return await buildPageMetadata({
    title: `${product.name} | ${settings.businessName}`,
    description: product.description,
    path: `/inventory/${product.slug}`,
    image: product.imageUrl || undefined,
    siteName: settings.businessName,
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
  const [product, origin] = await Promise.all([
    getCatalogDetail(slug),
    getRequestOrigin(),
  ]);

  // Enrich with real availability for the selected date/zip
  const productAsListing = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    category: product.category,
    price: product.price,
    description: product.description,
    status: "Available",
    imageUrl: product.imageUrl,
  };
  const { products: enriched } = await enrichCatalogAvailability([productAsListing], date, zip);
  const availabilityStatus = enriched[0]?.status ?? "Available";

  const checkoutParams = new URLSearchParams();
  checkoutParams.set("product", product.slug);
  if (date) checkoutParams.set("date", date);
  if (zip) checkoutParams.set("zip", zip);

  const galleryImages =
    product.galleryImages && product.galleryImages.length > 0
      ? product.galleryImages
      : ["", "", "", ""];

  const jsonLd = productJsonLd(
    {
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      category: product.category,
      imageUrl: product.imageUrl,
      status: availabilityStatus,
    },
    origin
  );

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
                style={{
                  backgroundImage: `url(${product.imageUrl || getPlaceholderImage(product.category)})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="storefront-thumb-grid">
                {galleryImages.slice(0, 4).map((image, index) => (
                  <div
                    key={`${image}-${index}`}
                    className="storefront-thumb"
                    style={{
                      backgroundImage: `url(${image || getPlaceholderImage(product.category)})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                ))}
              </div>
            </section>

            <aside className="panel storefront-summary-card">
              <div className="price-row" style={{ marginTop: 0 }}>
                <div className="kicker">{product.category}</div>
                <StatusBadge
                  label={availabilityStatus}
                  tone={
                    availabilityStatus.startsWith("Unavailable")
                      ? "danger"
                      : availabilityStatus === "Limited"
                        ? "warning"
                        : "success"
                  }
                />
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
                <Link
                  href={`/inventory${date || zip ? `?${new URLSearchParams({ ...(date ? { date } : {}), ...(zip ? { zip } : {}) }).toString()}` : ""}`}
                  className="secondary-btn"
                >
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
                      Our team delivers, sets up, and reviews everything with
                      you before we leave.
                    </div>
                  </div>
                  <div className="order-card">
                    <strong>Setup requirements</strong>
                    <div className="muted" style={{ marginTop: 6 }}>
                      Check your order confirmation for any space or access
                      requirements to keep event day smooth.
                    </div>
                  </div>
                  <div className="order-card">
                    <strong>Pickup handled later</strong>
                    <div className="muted" style={{ marginTop: 6 }}>
                      After the event, we return for pack-down so you can focus
                      on celebrating, not logistics.
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