import Link from "next/link";
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
import { PartyClassicPressRow } from "@/components/public/themes/party-classic/press-row";
import { PartyClassicCategoryTiles } from "@/components/public/themes/party-classic/category-tiles";
import { PartyClassicReviewsCards } from "@/components/public/themes/party-classic/reviews-cards";
import { PartyClassicServiceArea } from "@/components/public/themes/party-classic/service-area-zip-map";
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
    return await buildPageMetadata({
      title: "Korent | Rental software for operators",
      description:
        "Korent helps rental operators run bookings, inventory, payments, delivery routes, and customer documents from one platform.",
      path: "/",
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

      <main>
        <PartyClassicHero />

        <PartyClassicPressRow />

        {vis.trust_bar !== false && <PartyClassicTrustStrip />}

        {vis.category_grid !== false && <PartyClassicCategoryTiles />}

        {/* Popular rentals — kept on the existing CSS classes for now;
             the tile-style version comes in a follow-up. */}
        <section className="section storefront-section-soft">
          <div className="container">
            <div className="section-header">
              <div>
                <div className="kicker">{m.storefront.popularRentals.kicker}</div>
                <h2>{m.storefront.popularRentals.title}</h2>
                <div className="muted">{m.storefront.popularRentals.description}</div>
              </div>
              <Link href="/inventory" className="ghost-btn">
                {m.storefront.popularRentals.browseAll}
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

        {vis.how_it_works !== false && (
          <div id="how-it-works">
            <HowItWorks />
          </div>
        )}

        {vis.service_area_map !== false && (
          <div id="service-area">
            <PartyClassicServiceArea />
          </div>
        )}

        {vis.about_section !== false && (
          <AboutSection text={contentSettings.aboutText} />
        )}

        <PartyClassicReviewsCards />

        {vis.faq_section !== false && <FaqSection customFaqs={faqItems} />}

        <PublicFooter />
      </main>

      {isDemo && <DemoBanner />}
    </StorefrontShell>
  );
}
