import type { Metadata } from "next";
import { ProductCard } from "@/components/public/product-card";
import { HowItWorks } from "@/components/public/how-it-works";
import { FaqSection } from "@/components/public/faq-section";
import { AboutSection } from "@/components/public/about-section";
import { PublicFooter } from "@/components/public/public-footer";
import { StorefrontShell } from "@/components/public/themes/party-classic/storefront-shell";
import { PartyClassicHeader } from "@/components/public/themes/party-classic/header";
import { PartyClassicHero } from "@/components/public/themes/party-classic/hero";
import { PartyClassicTrustStrip } from "@/components/public/themes/party-classic/trust-strip";
import { PartyClassicBrowseTiles } from "@/components/public/themes/party-classic/browse-tiles";
import { PartyClassicCategoryTiles } from "@/components/public/themes/party-classic/category-tiles";
import { PartyClassicPressRow } from "@/components/public/themes/party-classic/press-row";
import { PartyClassicReviewsCards } from "@/components/public/themes/party-classic/reviews-cards";
import { PartyClassicServiceArea } from "@/components/public/themes/party-classic/service-area-zip-map";
import { PartyClassicClosing } from "@/components/public/themes/party-classic/closing";
import { SectionHead } from "@/components/public/themes/party-classic/section-head";
import { SaasLanding } from "@/components/marketing/saas-landing";
import { DemoBanner } from "@/components/demo/demo-banner";
import { isCurrentTenantDemo } from "@/lib/demo/context";
import { getFeaturedCatalogList } from "@/lib/data/catalog-list";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { isTenantHost } from "@/lib/auth/org-context";
import { getContentSettings } from "@/lib/data/content-settings";
import { buildPageMetadata, getRequestOrigin } from "@/lib/seo/metadata";
import { organizationJsonLd, faqJsonLd } from "@/lib/seo/json-ld";
import { JsonLdScript } from "@/components/seo/json-ld-script";
import { getTranslator } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const isTenant = await isTenantHost();
  if (!isTenant) {
    // Keyword-first title (the head term this page targets), brand last —
    // under 60 chars so it doesn't truncate in the SERP.
    return await buildPageMetadata({
      title: "Party Rental Business Software | Korent",
      description:
        "Run your party or event rental business online: a branded booking storefront, real-time inventory holds, payments, delivery routes, and crew scheduling — from $49/month.",
      path: "/",
      // Page-level openGraph REPLACES the layout's wholesale (Next.js
      // shallow-merges metadata per field) — without this the homepage
      // ships with no og:image at all.
      image: "/og-image.png",
    });
  }

  await requirePublicOrg();
  const settings = await getOrganizationSettings();

  return await buildPageMetadata({
    title: settings.businessName,
    description: `${settings.businessName} offers rentals with delivery and setup${settings.serviceAreaLabel ? ` across ${settings.serviceAreaLabel}` : ""}. Check availability and book online.`,
    path: "/",
    siteName: settings.businessName,
  });
}

export default async function HomePage() {
  // Root domain (no tenant resolved) → SaaS marketing page for operators
  // Tenant subdomains/custom domains → operator's storefront for end customers
  const isTenant = await isTenantHost();
  if (!isTenant) {
    return <SaasLanding />;
  }

  await requirePublicOrg();

  const [featured, settings, contentSettings, isDemo, origin, { messages }] = await Promise.all([
    getFeaturedCatalogList(),
    getOrganizationSettings(),
    getContentSettings(),
    isCurrentTenantDemo(),
    getRequestOrigin(),
    getTranslator(),
  ]);

  const m = messages;
  const vis = contentSettings.sectionVisibility;
  const faqItems =
    contentSettings.customFaq && contentSettings.customFaq.length > 0
      ? contentSettings.customFaq
      : m.storefront.faq.defaults.map((f) => ({ question: f.question, answer: f.answer }));

  return (
    <StorefrontShell>
      <PartyClassicHeader />
      <JsonLdScript data={organizationJsonLd({ ...settings, websiteMessage: settings.websiteMessage || undefined }, origin)} />
      {vis.faq_section !== false && (
        <JsonLdScript data={faqJsonLd(faqItems)} />
      )}

      <main id="main">
        <PartyClassicHero />

        {vis.trust_bar !== false && <PartyClassicTrustStrip />}

        {/* Operator-curated press logos — quiet "as seen on" row,
            hidden when no logos configured or operator turned off
            theme.pressRowVisible. */}
        <PartyClassicPressRow />

        {/* Shop by category — operator-curated catalog tiles. Renders
            only when the operator has active categories with products
            (the component returns null otherwise). The vertical-default
            "Browse by occasion" vibe tiles follow as the secondary
            shop-by-intent layer. Both share the vis.category_grid flag. */}
        {vis.category_grid !== false && <PartyClassicCategoryTiles />}

        {vis.category_grid !== false && <PartyClassicBrowseTiles />}

        {/* Featured rentals — editorial 3-up grid. Render at most three so
             the layout stays calm; tenants with more featured products see
             a "View the catalog →" link to the full inventory. */}
        {featured.length > 0 && (
          <section id="catalog" className="st-section">
            <div className="st-container">
              <SectionHead
                kicker={m.storefront.popularRentals.kicker}
                title={m.storefront.popularRentals.title}
                sub={m.storefront.popularRentals.description}
                link={
                  featured.length >= 3
                    ? { label: `${m.storefront.popularRentals.browseAll} →`, href: "/inventory" }
                    : undefined
                }
              />
              <div className="st-products-grid">
                {featured.slice(0, 3).map((product) => (
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
        )}

        {vis.how_it_works !== false && (
          <div id="how-it-works">
            <HowItWorks />
          </div>
        )}

        {vis.testimonials && <PartyClassicReviewsCards />}

        {vis.service_area_map !== false && (
          <div id="service-area">
            <PartyClassicServiceArea />
          </div>
        )}

        {/* Operator-written about copy. Default off (vis.about_section
            = false); renders only when the operator turns it on AND
            has written an aboutText. */}
        {vis.about_section !== false && (
          <AboutSection text={contentSettings.aboutText} />
        )}

        {vis.faq_section !== false && <FaqSection customFaqs={faqItems} />}

        <PartyClassicClosing />

        <PublicFooter />
      </main>

      {isDemo && <DemoBanner />}
    </StorefrontShell>
  );
}
