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
import { PartyClassicCustomRich } from "@/components/public/themes/party-classic/custom-rich";
import { PartyClassicCustomImage } from "@/components/public/themes/party-classic/custom-image";
import { PartyClassicCustomGallery } from "@/components/public/themes/party-classic/custom-gallery";
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
import { getStorefrontPageDocument } from "@/lib/storefront/page-document";
import { isKnownSectionType } from "@/lib/storefront/sections/registry";
import {
  parseHeroSettings,
  parseAboutSettings,
  parseTrustSettings,
  parseTestimonialsSettings,
  parseFaqSettings,
  parseCustomRichSettings,
  parseCustomImageSettings,
  parseCustomGallerySettings,
} from "@/lib/storefront/sections/content-schemas";
import { Fragment, type ReactNode } from "react";

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

  // Shared data fetches, hoisted ONCE and passed to both render paths so the
  // dormant document path introduces no N+1. (These are React-cache()-wrapped,
  // so even where a child component re-requests one it's deduped per request.)
  const [featured, settings, contentSettings, isDemo, origin, { messages }, doc] =
    await Promise.all([
      getFeaturedCatalogList(),
      getOrganizationSettings(),
      getContentSettings(),
      isCurrentTenantDemo(),
      getRequestOrigin(),
      getTranslator(),
      // DORMANT document-driven path. Null for ALL orgs today (none have a
      // published page document with a non-empty `order`), so every storefront
      // falls through to the unchanged legacy hardcoded sequence below.
      getStorefrontPageDocument("published"),
    ]);

  const m = messages;
  const vis = contentSettings.sectionVisibility;
  const faqItems =
    contentSettings.customFaq && contentSettings.customFaq.length > 0
      ? contentSettings.customFaq
      : m.storefront.faq.defaults.map((f) => ({ question: f.question, answer: f.answer }));

  // Type → render branch for the document-driven path. Each branch produces the
  // SAME markup the legacy hardcoded sequence emits for that section type, so a
  // synthesized default document renders byte-for-byte what the legacy path
  // does. Unknown types are filtered out before this map is consulted.
  const renderSection = (
    type: string,
    settings?: Record<string, unknown>
  ): ReactNode => {
    switch (type) {
      case "hero": {
        // Hero/about are the only PR-1c content-editable types: pass the
        // document section's validated settings (absent fields fall back inside
        // the component to today's behavior). Every other type renders with NO
        // props, exactly as before.
        const hero = parseHeroSettings(settings);
        return (
          <PartyClassicHero
            headline={hero.headline}
            message={hero.message}
            imageUrl={hero.imageUrl}
          />
        );
      }
      case "trust": {
        // PR-1d content-editable: pass the document's curated badges (absent →
        // the component falls back to today's content settings / defaults).
        const trust = parseTrustSettings(settings);
        return <PartyClassicTrustStrip badges={trust.badges} />;
      }
      case "press":
        return <PartyClassicPressRow />;
      case "category-grid":
        return <PartyClassicCategoryTiles />;
      case "browse-tiles":
        return <PartyClassicBrowseTiles />;
      case "featured":
        return featured.length > 0 ? (
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
        ) : null;
      case "how-it-works":
        return (
          <div id="how-it-works">
            <HowItWorks />
          </div>
        );
      case "testimonials": {
        // PR-1d content-editable: pass the document's testimonials (absent →
        // the component falls back to today's content settings).
        const reviews = parseTestimonialsSettings(settings);
        return <PartyClassicReviewsCards testimonials={reviews.items} />;
      }
      case "service-area":
        return (
          <div id="service-area">
            <PartyClassicServiceArea />
          </div>
        );
      case "about": {
        const about = parseAboutSettings(settings);
        return (
          <AboutSection
            text={about.body || contentSettings.aboutText}
            heading={about.heading}
          />
        );
      }
      case "faq": {
        // PR-1d content-editable: when the document carries FAQ items use them;
        // absent → fall back to today's faqItems (custom_faq / i18n defaults).
        const faq = parseFaqSettings(settings);
        return (
          <FaqSection
            customFaqs={faq.items && faq.items.length > 0 ? faq.items : faqItems}
          />
        );
      }
      case "closing":
        return <PartyClassicClosing />;
      case "custom-rich": {
        // PR-1e operator-added section. Parse defensively → the component
        // returns null when neither heading nor body is present (empty section).
        const rich = parseCustomRichSettings(settings);
        return <PartyClassicCustomRich heading={rich.heading} body={rich.body} />;
      }
      case "custom-image": {
        const image = parseCustomImageSettings(settings);
        return (
          <PartyClassicCustomImage
            imageUrl={image.imageUrl}
            alt={image.alt}
            caption={image.caption}
          />
        );
      }
      case "custom-gallery": {
        const gallery = parseCustomGallerySettings(settings);
        return <PartyClassicCustomGallery images={gallery.images} />;
      }
      default:
        return null;
    }
  };

  // DOCUMENT-DRIVEN PATH (dormant today): render the published document's
  // sections in order, skipping disabled ones and any type not in the registry.
  // Unknown types render nothing — never crash.
  if (doc) {
    return (
      <StorefrontShell>
        <PartyClassicHeader />
        <JsonLdScript data={organizationJsonLd({ ...settings, websiteMessage: settings.websiteMessage || undefined }, origin)} />
        {vis.faq_section !== false && (
          <JsonLdScript data={faqJsonLd(faqItems)} />
        )}

        <main id="main">
          {doc.order.map((id) => {
            const section = doc.sections[id];
            if (!section) return null;
            if (section.disabled) return null;
            if (!isKnownSectionType(section.type)) return null;
            return (
              <Fragment key={id}>
                {renderSection(section.type, section.settings)}
              </Fragment>
            );
          })}

          <PublicFooter />
        </main>

        {isDemo && <DemoBanner />}
      </StorefrontShell>
    );
  }

  // LEGACY HARDCODED PATH (taken by ALL orgs today): unchanged byte-for-byte.
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
