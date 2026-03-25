import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCatalogDetail } from "@/lib/data/catalog-detail";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getCatalogDetail(slug);

  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container two-col">
          <section className="panel">
            {product.images.length > 0 ? (
              <>
                <div
                  className="product-media"
                  style={{
                    height: 320,
                    borderRadius: 18,
                    backgroundImage: `url(${product.images[0].url})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                  role="img"
                  aria-label={product.images[0].alt || product.name}
                />
                {product.images.length > 1 && (
                  <div
                    className="grid"
                    style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 14 }}
                  >
                    {product.images.slice(1, 5).map((img, i) => (
                      <div
                        key={i}
                        className="product-media"
                        style={{
                          height: 80,
                          borderRadius: 12,
                          backgroundImage: `url(${img.url})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                        role="img"
                        aria-label={img.alt || `${product.name} photo ${i + 2}`}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div
                  className="product-media"
                  style={{ height: 320, borderRadius: 18 }}
                />
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 14 }}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <div
                      key={n}
                      className="product-media"
                      style={{ height: 80, borderRadius: 12 }}
                    />
                  ))}
                </div>
              </>
            )}
          </section>

          <aside className="panel">
            <div className="price-row" style={{ marginTop: 0 }}>
              <div className="kicker">{product.category}</div>
              <StatusBadge label="Available" tone="success" />
            </div>

            <h1 style={{ margin: "8px 0 6px" }}>{product.name}</h1>
            <p className="muted">{product.description}</p>

            <div className="price-row">
              <strong style={{ fontSize: "2rem" }}>{product.price}</strong>
              <span className="badge">Deposit at checkout</span>
            </div>

            <div className="list" style={{ marginTop: 16 }}>
              {product.highlights.map((highlight) => (
                <div key={highlight} className="order-card">
                  {highlight}
                </div>
              ))}
            </div>

            <div className="price-row" style={{ marginTop: 18 }}>
              <Link href={`/checkout?product=${product.slug}`} className="primary-btn">
                Reserve Now
              </Link>
              <Link href="/inventory" className="secondary-btn">
                Back
              </Link>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}