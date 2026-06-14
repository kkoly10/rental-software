import Link from "next/link";
import type { Metadata } from "next";
import { getStorefrontFallbackImage } from "@/lib/media/storefront-fallback-images";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { BookNowWithMode } from "@/components/public/book-now-with-mode";
import { CapacityCalculator } from "@/components/public/capacity-calculator";
import { getCatalogDetail } from "@/lib/data/catalog-detail";
import { enrichCatalogAvailability } from "@/lib/data/catalog-availability";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getThemeSettings } from "@/lib/data/theme-settings";
import { getBookingPolicies } from "@/lib/data/booking-policies";
import { resolveServiceAreaForAddress } from "@/lib/service-areas/lookup";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { RequestQuoteForm } from "@/components/public/request-quote-form";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { DemoBanner } from "@/components/demo/demo-banner";
import { isCurrentTenantDemo } from "@/lib/demo/context";
import { buildPageMetadata, getRequestOrigin } from "@/lib/seo/metadata";
import { productJsonLd } from "@/lib/seo/json-ld";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { prettifyCategoryName } from "@/lib/utils/prettify-category";
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

  if (!product) {
    return await buildPageMetadata({
      title: "Product not found",
      description: "This rental is not available.",
      path: `/inventory/${slug}`,
    });
  }

  return await buildPageMetadata({
    title: `${product.name} — ${settings.businessName}`,
    description: product.description,
    path: `/inventory/${slug}`,
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
  const { slug } = await params;
  const { date, zip } = await searchParams;

  const [product, theme, origin, { messages: m, t }, isDemo, policies] = await Promise.all([
    getCatalogDetail(slug),
    getThemeSettings(),
    getRequestOrigin(),
    getTranslator(),
    isCurrentTenantDemo(),
    getBookingPolicies(),
  ]);

  if (!product) {
    return (
      <>
        <PublicHeader />
        <main id="main">
          <section className="st-container st-pdp">
            <div className="st-empty-state">
              <span className="st-eyebrow">{m.inventoryDetail.unavailableForDate}</span>
              <h1 className="st-empty-state-title">{m.inventoryDetail.notAvailableTitle}</h1>
              <p className="st-empty-state-body">{m.inventoryDetail.notAvailableBody}</p>
              <p style={{ marginTop: 24 }}>
                <Link href="/inventory" className="st-text-link">
                  {m.inventoryDetail.backToCatalog} →
                </Link>
              </p>
            </div>
          </section>
        </main>
        <PublicFooter />
      </>
    );
  }

  // A URL we can actually render — absolute http(s) or root-relative.
  // Gallery rows in production occasionally carry truthy-but-broken
  // values (bare filenames, whitespace, stale storage keys) which
  // pass a simple Boolean filter and then paint as empty rectangles.
  const isRenderableImageUrl = (url: unknown): url is string =>
    typeof url === "string" &&
    (/^https?:\/\//.test(url.trim()) || url.trim().startsWith("/"));

  // Per-vertical fallback + slug/category-keyed local fallback chain —
  // same logic the homepage product cards use, so the PDP hero never
  // falls back to the dead /placeholders/*.png artwork.
  const heroImage = isRenderableImageUrl(product.imageUrl)
    ? product.imageUrl
    : getStorefrontFallbackImage(product.slug, product.category);
  const displayCategory = prettifyCategoryName(product.category);

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
  const statusToken = availabilityStatus.startsWith("Unavailable")
    ? "unavailable"
    : availabilityStatus === "Limited"
    ? "limited"
    : "available";

  const checkoutParams = new URLSearchParams();
  checkoutParams.set("product", product.slug);
  if (date) checkoutParams.set("date", date);
  if (zip) checkoutParams.set("zip", zip);

  // Gallery — render only gallery images that will actually paint.
  // filter(Boolean) let truthy-but-broken rows (bare filenames, stale
  // storage keys) through, which rendered as four empty rectangles on
  // production. If nothing survives the filter, the strip is omitted
  // and the hero photo stands alone.
  const galleryImages = (product.galleryImages ?? []).filter(isRenderableImageUrl);

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

  const backHref = `/inventory${
    date || zip
      ? `?${new URLSearchParams({ ...(date ? { date } : {}), ...(zip ? { zip } : {}) }).toString()}`
      : ""
  }`;

  // Deposit + delivery disclosure (FTC junk-fee guidance: surface mandatory
  // cost terms up front, not at checkout). The deposit percentage mirrors what
  // checkout actually charges — same getBookingPolicies() source. The delivery
  // line shows the operator's real per-ZIP service-area fee when the visitor
  // arrived with a ZIP; otherwise it states delivery is ZIP-dependent (never a
  // fabricated number).
  const depositRequired =
    policies.depositPercentage > 0 ||
    (policies.depositMinimum != null && policies.depositMinimum > 0);

  let deliveryArea: Awaited<ReturnType<typeof resolveServiceAreaForAddress>> = null;
  if (zip) {
    const orgId = await getPublicOrgId();
    if (orgId) {
      deliveryArea = await resolveServiceAreaForAddress({
        organizationId: orgId,
        postalCode: zip,
      }).catch(() => null);
    }
  }
  const fmtMoney = (n: number) => `$${n.toFixed(2)}`;

  return (
    <>
      <PublicHeader />
      <JsonLdScript data={jsonLd} />

      <main id="main">
        <section className="st-container st-pdp">
          {(date || zip) && (
            <div className="st-context-chips">
              {date && (
                <span className="st-context-chip">
                  {t(m.inventory.pillDate, { value: date })}
                </span>
              )}
              {zip && (
                <span className="st-context-chip">
                  {t(m.inventory.pillZip, { value: zip })}
                </span>
              )}
            </div>
          )}

          <div className="st-pdp-shell">
            {/* Gallery */}
            <div className="st-pdp-gallery">
              <div
                className="st-pdp-gallery-main"
                style={{ backgroundImage: `url("${heroImage}")` }}
                role="img"
                aria-label={product.name}
              />
              {galleryImages.length > 0 && (
                <div className="st-pdp-thumbs">
                  {galleryImages.slice(0, 4).map((image, index) => (
                    <div
                      key={`${image}-${index}`}
                      className="st-pdp-thumb"
                      style={{ backgroundImage: `url("${image}")` }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Summary */}
            <aside className="st-pdp-summary">
              <div className="st-pdp-meta-row">
                <span className="st-eyebrow">{displayCategory}</span>
                <span className="st-status" data-state={statusToken}>
                  {availabilityStatus}
                </span>
              </div>

              <h1 className="st-pdp-title">{product.name}</h1>
              <p className="st-pdp-lede">{product.description}</p>

              <div className="st-pdp-price-row">
                <div className="st-pdp-price">
                  {product.capabilitySlugs?.includes("pricing.per-hour") &&
                  product.hourlyRateCents != null ? (
                    <>
                      ${(product.hourlyRateCents / 100).toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
                      <small>/ hour</small>
                      {product.minimumHours && product.minimumHours > 0 && (
                        <span className="st-pdp-price-min">
                          {product.minimumHours}-hour minimum
                        </span>
                      )}
                    </>
                  ) : (
                    <>{product.price}</>
                  )}
                </div>
                <span className="st-pdp-deposit-note">
                  {depositRequired
                    ? t(m.inventoryDetail.depositTag, { percent: policies.depositPercentage })
                    : m.inventoryDetail.depositTagNone}
                </span>
              </div>

              <div className="st-pdp-facts">
                {depositRequired && (
                  <span className="st-pdp-fact">
                    {m.inventoryDetail.depositBalanceNote}
                    {policies.depositMinimum != null && policies.depositMinimum > 0 && (
                      <>
                        {" · "}
                        {t(m.inventoryDetail.depositMinimumNote, {
                          amount: fmtMoney(policies.depositMinimum),
                        })}
                      </>
                    )}
                  </span>
                )}
                <span className="st-pdp-fact">
                  {deliveryArea
                    ? deliveryArea.deliveryFee > 0
                      ? t(m.inventoryDetail.deliveryToArea, {
                          zip: zip ?? "",
                          fee: fmtMoney(deliveryArea.deliveryFee),
                        })
                      : t(m.inventoryDetail.deliveryFreeToArea, { zip: zip ?? "" })
                    : m.inventoryDetail.deliveryByZip}
                </span>
              </div>

              {product.highlights.length > 0 && (
                <div className="st-pdp-highlights">
                  {product.highlights.map((highlight) => (
                    <div key={highlight} className="st-pdp-highlight">
                      {highlight}
                    </div>
                  ))}
                </div>
              )}

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
                  <div className="st-pdp-specs">
                    <span className="st-eyebrow st-pdp-specs-kicker">Specs</span>
                    <dl className="st-pdp-specs-list">
                      {product.specs.map((spec) => (
                        <div key={spec.id} style={{ display: "contents" }}>
                          <dt>{spec.specLabel}</dt>
                          <dd>{spec.specValue}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}

              {/* Date + ZIP picker — the core booking gesture, previously
                  only settable via the URL. Native GET form reloads this PDP
                  with ?date&zip, which updates the availability status, the
                  delivery-fee line, and threads the values into checkout.
                  No client JS needed; reuses the hero's field labels. */}
              <form
                method="get"
                action={`/inventory/${slug}`}
                className="st-pdp-availability"
                role="search"
              >
                <div className="st-pdp-availability-fields">
                  <label className="st-pdp-availability-field">
                    <span className="st-eyebrow">{m.storefront.hero.eventDate}</span>
                    <input
                      name="date"
                      type="date"
                      defaultValue={date ?? ""}
                      className="st-pdp-input"
                    />
                  </label>
                  <label className="st-pdp-availability-field">
                    <span className="st-eyebrow">{m.storefront.hero.deliveryZip}</span>
                    <input
                      name="zip"
                      type="text"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      maxLength={10}
                      pattern="[0-9-]*"
                      placeholder={m.storefront.hero.zipPlaceholder}
                      defaultValue={zip ?? ""}
                      className="st-pdp-input"
                    />
                  </label>
                </div>
                <button type="submit" className="st-pdp-availability-go">
                  {m.storefront.hero.checkAvailability}
                </button>
              </form>

              {/* Phase 2e.12 — variant picker moved into BookNowWithMode
                  so the customer's pick can be threaded through to
                  the checkout query and the order_items insert. */}

              <BookNowWithMode
                checkoutQuery={checkoutParams.toString()}
                basePriceCents={product.basePriceCents ?? 0}
                supportsModes={product.supportsModes ?? ["dry"]}
                wetUpchargeCents={product.wetUpchargeCents ?? null}
                backHref={backHref}
                product={{
                  slug: product.slug,
                  name: product.name,
                  imageUrl: heroImage,
                  priceLabel: product.price,
                }}
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
                <details className="st-pdp-quote">
                  <summary>Need a custom quote?</summary>
                  <div className="st-pdp-quote-body">
                    <p>
                      Use this for events that need site review or itemized pricing — the
                      operator will email you a tailored quote.
                    </p>
                    <div style={{ marginTop: 12 }}>
                      <RequestQuoteForm
                        productSlug={product.slug}
                        initialDate={date}
                        initialZip={zip}
                      />
                    </div>
                  </div>
                </details>
              )}
            </aside>
          </div>

          {/* What to expect / Best fit — editorial twin column below the shell. */}
          <div className="st-pdp-extras">
            <div className="st-pdp-extras-col">
              <span className="st-eyebrow">{m.inventoryDetail.whatToExpect.kicker}</span>
              <h2>{m.inventoryDetail.whatToExpect.title}</h2>
              <div className="st-pdp-extras-list">
                {m.inventoryDetail.whatToExpect.items.map((item) => (
                  <div key={item.title} className="st-pdp-extras-item">
                    <strong>{item.title}</strong>
                    <div className="body">{item.body}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="st-pdp-extras-col">
              <span className="st-eyebrow">{m.inventoryDetail.bestFit.kicker}</span>
              <h2>{m.inventoryDetail.bestFit.title}</h2>
              <div className="st-pdp-extras-list">
                {m.inventoryDetail.bestFit.items.map((item) => (
                  <div key={item} className="st-pdp-extras-item-simple">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
      {isDemo && <DemoBanner />}
    </>
  );
}
