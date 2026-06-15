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
  parseClosingSettings,
  parseHowItWorksSettings,
  parseServiceAreaSettings,
  parseFeaturedSettings,
  parseFieldStyles,
  hasFieldSelectors,
  SECTION_FIELD_SELECTORS,
  FONT_STACKS,
  type FieldStyle,
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
    case "featured": {
      // PR-1f content-editable: override the section head's kicker/title/sub
      // when present (absent → today's i18n popularRentals copy → byte-for-byte).
      const featuredSettings = parseFeaturedSettings(settings);
      return featured.length > 0 ? (
        <section id="catalog" className="st-section">
          <div className="st-container">
            <SectionHead
              kicker={featuredSettings.kicker || m.storefront.popularRentals.kicker}
              title={featuredSettings.title || m.storefront.popularRentals.title}
              sub={featuredSettings.description || m.storefront.popularRentals.description}
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
    }
    case "how-it-works": {
      // PR-1f content-editable: heading/intro (+ optional steps) overrides;
      // absent → today's i18n copy inside the component (byte-for-byte).
      const howItWorks = parseHowItWorksSettings(settings);
      return (
        <div id="how-it-works">
          <HowItWorks
            heading={howItWorks.heading}
            intro={howItWorks.intro}
            steps={howItWorks.steps}
          />
        </div>
      );
    }
    case "testimonials": {
      // PR-1d content-editable: pass the document's testimonials (absent →
      // the component falls back to today's content settings).
      const reviews = parseTestimonialsSettings(settings);
      return <PartyClassicReviewsCards testimonials={reviews.items} />;
    }
    case "service-area": {
      // PR-1f content-editable: heading/intro overrides; absent → today's i18n
      // copy inside the component (byte-for-byte).
      const serviceArea = parseServiceAreaSettings(settings);
      return (
        <div id="service-area">
          <PartyClassicServiceArea
            heading={serviceArea.heading}
            intro={serviceArea.intro}
          />
        </div>
      );
    }
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
    case "closing": {
      // PR-1f content-editable: heading/body/buttonLabel overrides; absent →
      // today's i18n copy inside the component (byte-for-byte).
      const closing = parseClosingSettings(settings);
      return (
        <PartyClassicClosing
          heading={closing.heading}
          body={closing.body}
          buttonLabel={closing.buttonLabel}
        />
      );
    }
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
 * Optional behaviour switches for the document renderer.
 *
 * `editable` turns on the ON-CANVAS EDITOR mode (PR-2a): every section is
 * rendered (including `disabled` ones, so the operator can re-enable them) and
 * each node is wrapped in a layout-neutral marker (`.st-editable-section`) the
 * client editor overlay reads via `[data-st-section-id]` to position its hover
 * frame / selection toolbar. Unknown types are still skipped.
 *
 * When `editable` is falsy (the DEFAULT — the live public page and the public
 * preview), behaviour is BYTE-FOR-BYTE identical to before this option existed:
 * disabled/unknown sections are skipped and the section node is returned with no
 * wrapper element. This is a hard safety requirement — the public render must
 * not change.
 */
type RenderDocumentSectionsOptions = {
  editable?: boolean;
};

/**
 * The per-element style wrapper is `display:contents` so it adds the scoped
 * class WITHOUT introducing a layout box — the section's own markup keeps its
 * exact place in the flow (the wrapper is only ever emitted when there ARE
 * overrides, so the public default render is untouched).
 */
const CONTENTS_STYLE = { display: "contents" } as const;

/**
 * Build the CSS DECLARATIONS for one field's style override (PR-A). Every value
 * here is computed from already-validated data — an integer px size, a
 * regex-validated hex color, fixed weight/style literals, and a font-family
 * looked up from the FONT_STACKS allowlist (never the raw enum value). No user
 * free-text is ever interpolated, so the generated rule can't break out of its
 * declaration block.
 */
function fieldStyleDeclarations(style: FieldStyle): string {
  const decls: string[] = [];
  if (typeof style.sizePx === "number") {
    decls.push(`font-size:${style.sizePx}px`);
  }
  if (typeof style.color === "string") {
    decls.push(`color:${style.color}`);
  }
  if (style.bold === true) {
    decls.push("font-weight:700");
  }
  if (style.italic === true) {
    decls.push("font-style:italic");
  }
  if (style.font) {
    const stack = FONT_STACKS[style.font];
    if (stack) decls.push(`font-family:${stack}`);
  }
  return decls.join(";");
}

/**
 * Build the SCOPED stylesheet text for a section's per-element style overrides
 * (PR-A). Each styled field maps (via the SHARED SECTION_FIELD_SELECTORS map) to
 * a CSS selector, scoped under the section's unique wrapper class so the rules
 * only ever affect THAT section's nodes. Returns "" when nothing styles — the
 * caller uses that to decide whether to wrap/emit at all (byte-for-byte safety).
 */
function buildScopedStyleCss(
  type: string,
  fieldStyles: Record<string, FieldStyle>,
  uniqueClass: string
): string {
  if (!hasFieldSelectors(type)) return "";
  const selectors = SECTION_FIELD_SELECTORS[type];
  const rules: string[] = [];
  for (const [field, style] of Object.entries(fieldStyles)) {
    const selector = (selectors as Record<string, string | undefined>)[field];
    if (!selector) continue; // field has no rendered target → nothing to style
    const decls = fieldStyleDeclarations(style);
    if (!decls) continue;
    rules.push(`.${uniqueClass} ${selector}{${decls}}`);
  }
  return rules.join("");
}

/**
 * Render the document's sections in order, skipping disabled ones and any type
 * not in the registry (unknown types render nothing — never crash). Returns the
 * ordered list of section nodes — the SAME output app/page.tsx's document branch
 * produced inline. Used by both the live public page and the builder preview.
 *
 * In `editable` mode (the on-canvas editor) the output instead includes ALL
 * sections (disabled ones too, marked so CSS can grey them) wrapped in a
 * layout-neutral `.st-editable-section` div carrying `data-st-section-*` attrs.
 */
export function renderDocumentSections(
  doc: StorefrontPageDocument,
  ctx: DocumentSectionContext,
  options?: RenderDocumentSectionsOptions
): ReactNode {
  const editable = options?.editable === true;

  return doc.order.map((id) => {
    const section = doc.sections[id];
    if (!section) return null;
    // Editor shows disabled sections (so they can be re-enabled); the live
    // render skips them — UNCHANGED default behaviour.
    if (!editable && section.disabled) return null;
    if (!isKnownSectionType(section.type)) return null;

    const node = renderDocumentSection(ctx, section.type, section.settings);

    // Per-element (Wix-like) style overrides (PR-A). Defensively parse the
    // section's fieldStyles, build a SCOPED stylesheet keyed by a unique class,
    // and — ONLY when there's something to style — wrap the section node in a
    // layout-neutral div carrying that class plus an adjacent <style>. When
    // fieldStyles is absent/empty the CSS is "" and we emit NOTHING extra, so the
    // public render stays byte-for-byte identical to before this feature.
    const fieldStyles = parseFieldStyles(section.settings);
    const uniqueClass = `st-fs-${id}`;
    const scopedCss =
      Object.keys(fieldStyles).length > 0
        ? buildScopedStyleCss(section.type, fieldStyles, uniqueClass)
        : "";

    if (!editable) {
      if (!scopedCss) {
        return <Fragment key={id}>{node}</Fragment>;
      }
      // Layout-neutral wrapper (display:contents) so the scoped class can match
      // descendants without introducing a box that could change the layout.
      return (
        <div key={id} className={uniqueClass} style={CONTENTS_STYLE}>
          <style dangerouslySetInnerHTML={{ __html: scopedCss }} />
          {node}
        </div>
      );
    }

    // Editor mode: wrap in a layout-neutral marker the client overlay reads.
    // When the section has per-element styles, also add the scoped class + style
    // so the canvas previews them live (the same markup the public site emits).
    return (
      <div
        key={id}
        data-st-section-id={id}
        data-st-section-type={section.type}
        data-st-disabled={section.disabled ? "true" : undefined}
        className={
          scopedCss
            ? `st-editable-section ${uniqueClass}`
            : "st-editable-section"
        }
      >
        {scopedCss ? (
          <style dangerouslySetInnerHTML={{ __html: scopedCss }} />
        ) : null}
        {node}
      </div>
    );
  });
}
