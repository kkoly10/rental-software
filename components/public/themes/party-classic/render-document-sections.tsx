import { Fragment, type ReactNode } from "react";
import { ProductCard } from "@/components/public/product-card";
import { HowItWorks } from "@/components/public/how-it-works";
import { FaqSection } from "@/components/public/faq-section";
import { AboutSection } from "@/components/public/about-section";
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
import { isKnownSectionType } from "@/lib/storefront/sections/registry";
import type { StorefrontPageDocument } from "@/lib/storefront/page-document";
import type { ContentSettings } from "@/lib/data/content-settings";
import type { CatalogProduct } from "@/lib/types";
import type { Messages } from "@/lib/i18n/messages/en";
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

type FeaturedProduct = Awaited<
  ReturnType<typeof import("@/lib/data/catalog-list").getFeaturedCatalogList>
>[number];

type FaqItem = { question: string; answer: string };

/**
 * Per-request render context shared by every document section branch. These are
 * the exact per-request values app/page.tsx's `renderSection` closure used to
 * capture; passing them explicitly lets the SAME renderer back both the live
 * public page (app/page.tsx) and the builder preview route — so the two can't
 * drift.
 */
export type DocumentSectionContext = {
  featured: FeaturedProduct[];
  contentSettings: ContentSettings;
  messages: Messages;
  faqItems: FaqItem[];
};

/**
 * Render a single document section to its node — the SAME markup app/page.tsx
 * historically emitted for each type. Unknown types return null (filtered out
 * before this is consulted, but defensive). Extracted verbatim from
 * app/page.tsx's `renderSection` closure (PR-1f); no behaviour change.
 */
function renderDocumentSection(
  ctx: DocumentSectionContext,
  type: string,
  settings?: Record<string, unknown>
): ReactNode {
  const { featured, contentSettings, messages: m, faqItems } = ctx;
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
}

/**
 * Render the document's sections in order, skipping disabled ones and any type
 * not in the registry (unknown types render nothing — never crash). Returns the
 * ordered list of section nodes — the SAME output app/page.tsx's document branch
 * produced inline. Used by both the live public page and the builder preview.
 */
export function renderDocumentSections(
  doc: StorefrontPageDocument,
  ctx: DocumentSectionContext
): ReactNode {
  return doc.order.map((id) => {
    const section = doc.sections[id];
    if (!section) return null;
    if (section.disabled) return null;
    if (!isKnownSectionType(section.type)) return null;
    return (
      <Fragment key={id}>
        {renderDocumentSection(ctx, section.type, section.settings)}
      </Fragment>
    );
  });
}
