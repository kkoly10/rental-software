import Link from "next/link";
import type { Metadata } from "next";
import { getPlaceholderImage } from "@/lib/utils/placeholders";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { BookNowWithMode } from "@/components/public/book-now-with-mode";
import { CapacityCalculator } from "@/components/public/capacity-calculator";
import { StatusBadge } from "@/components/ui/status-badge";
import { getCatalogDetail } from "@/lib/data/catalog-detail";
import { enrichCatalogAvailability } from "@/lib/data/catalog-availability";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getThemeSettings } from "@/lib/data/theme-settings";
import { RequestQuoteForm } from "@/components/public/request-quote-form";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { DemoBanner } from "@/components/demo/demo-banner";
import { isCurrentTenantDemo } from "@/lib/demo/context";
import { buildPageMetadata, getRequestOrigin } from "@/lib/seo/metadata";
import { productJsonLd } from "@/lib/seo/json-ld";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { getTranslator } from "@/lib/i18n/server";

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
  const [product, origin, { messages: m, t }, theme] = await Promise.all([
    getCatalogDetail(slug),
    getRequestOrigin(),
    getTranslator(),
    getThemeSettings(),
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
              <span className="storefront-context-pill">{t(m.inventory.pillDate, { value: date })}</span>
            ) : null}
            {zip ? <span className="storefront-context-pill">{t(m.inventory.pillZip, { value: zip })}</span> : null}
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
                {product.capabilitySlugs?.includes("pricing.per-hour") &&
                product.hourlyRateCents != null ? (
                  <div>
                    <strong style={{ fontSize: "2rem" }}>
                      ${(product.hourlyRateCents / 100).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                    </strong>
                    <span
                      className="muted"
                      style={{ fontSize: "1rem", marginLeft: 6 }}
                    >
                      / hour
                    </span>
                    {product.minimumHours && product.minimumHours > 0 && (
                      <div
                        className="muted"
                        style={{ fontSize: "0.88rem", marginTop: 4 }}
                      >
                        {product.minimumHours}-hour minimum
                      </div>
                    )}
                  </div>
                ) : (
                  <strong style={{ fontSize: "2rem" }}>{product.price}</strong>
                )}
                <span className="badge">{m.inventoryDetail.depositReservesDate}</span>
              </div>

              <div className="storefront-highlight-list">
                {product.highlights.map((highlight) => (
                  <div key={highlight} className="order-card">
                    {highlight}
                  </div>
                ))}
              </div>

              {/* Phase 1c — capacity calculator widget. Renders
                  per metric: dance-floor shows an interactive guest-
                  count input; guests/sq_ft/servings show a static
                  capacity statement. Both gates fire: the capability
                  slug AND a non-null capacity_value. */}
              {product.capabilitySlugs?.includes("display.capacity-calculator") &&
                product.capacityMetric &&
                typeof product.capacityValue === "number" &&
                product.capacityValue > 0 && (
                  <CapacityCalculator
                    metric={product.capacityMetric}
                    value={product.capacityValue}
                  />
                )}

              {/* Phase 2e.8 — structured specs definition list. */}
              {product.capabilitySlugs?.includes("display.structured-specs") &&
                product.specs &&
                product.specs.length > 0 && (
                  <div
                    className="order-card"
                    style={{ marginTop: 18, padding: 16 }}
                  >
                    <strong
                      style={{
                        display: "block",
                        fontSize: "0.78rem",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                        color: "var(--text-muted, #6b7280)",
                        marginBottom: 12,
                      }}
                    >
                      Specs
                    </strong>
                    <dl
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto 1fr",
                        gap: "8px 16px",
                        margin: 0,
                        fontSize: "0.92rem",
                      }}
                    >
                      {product.specs.map((spec) => (
                        <div
                          key={spec.id}
                          style={{ display: "contents" }}
                        >
                          <dt style={{ fontWeight: 600 }}>
                            {spec.specLabel}
                          </dt>
                          <dd style={{ margin: 0 }}>{spec.specValue}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

              {/* Phase 2e.12 — variant picker moved into BookNowWithMode
                  so the customer's pick can be threaded through to
                  the checkout query and the order_items insert. */}

              <BookNowWithMode
                checkoutQuery={checkoutParams.toString()}
                basePriceCents={product.basePriceCents ?? 0}
                supportsModes={product.supportsModes ?? ["dry"]}
                wetUpchargeCents={product.wetUpchargeCents ?? null}
                backHref={`/inventory${date || zip ? `?${new URLSearchParams({ ...(date ? { date } : {}), ...(zip ? { zip } : {}) }).toString()}` : ""}`}
                perUnit={
                  product.capabilitySlugs?.includes("pricing.per-unit") &&
                  typeof product.unitPriceCents === "number" &&
                  product.unitPriceCents > 0
                    ? {
                        unitPriceCents: product.unitPriceCents,
                        unitLabel: product.unitLabel ?? "unit",
                        minimumQuantity: product.minimumOrderQuantity ?? 0,
                      }
                    : null
                }
                variants={
                  product.capabilitySlugs?.includes("display.variant-gallery") &&
                  product.variants &&
                  product.variants.length > 0
                    ? product.variants.map((v) => ({
                        id: v.id,
                        label: v.label,
                        thumbnailUrl: v.thumbnailUrl,
                        priceDeltaCents: v.priceDeltaCents,
                        isDefault: v.isDefault,
                      }))
                    : undefined
                }
                addOns={
                  product.capabilitySlugs?.includes("composition.add-ons") &&
                  product.addOns &&
                  product.addOns.length > 0
                    ? product.addOns.map((a) => ({
                        addonProductId: a.addonProductId,
                        name: a.name,
                        basePriceCents: a.basePriceCents,
                        defaultQuantity: a.defaultQuantity,
                        maxQuantity: a.maxQuantity,
                        isRequired: a.isRequired,
                      }))
                    : undefined
                }
              />
              {theme.ctaSecondary === "request_quote" && (
                <details
                  className="order-card"
                  style={{ marginTop: 14, padding: 14 }}
                >
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                    Need a custom quote?
                  </summary>
                  <p className="muted" style={{ marginTop: 8, fontSize: 13, lineHeight: 1.6 }}>
                    Use this for events that need site review or itemized pricing — the
                    operator will email you a tailored quote.
                  </p>
                  <div style={{ marginTop: 10 }}>
                    <RequestQuoteForm
                      productSlug={product.slug}
                      initialDate={date}
                      initialZip={zip}
                    />
                  </div>
                </details>
              )}
            </aside>
          </div>

          <section className="section storefront-detail-section">
            <div className="storefront-detail-grid">
              <div className="panel">
                <div className="kicker">{m.inventoryDetail.whatToExpect.kicker}</div>
                <h2 style={{ margin: "8px 0 10px" }}>
                  {m.inventoryDetail.whatToExpect.title}
                </h2>
                <div className="list">
                  {m.inventoryDetail.whatToExpect.items.map((item) => (
                    <div key={item.title} className="order-card">
                      <strong>{item.title}</strong>
                      <div className="muted" style={{ marginTop: 6 }}>
                        {item.body}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="kicker">{m.inventoryDetail.bestFit.kicker}</div>
                <h2 style={{ margin: "8px 0 10px" }}>{m.inventoryDetail.bestFit.title}</h2>
                <div className="list">
                  {m.inventoryDetail.bestFit.items.map((item) => (
                    <div key={item} className="order-card">{item}</div>
                  ))}
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