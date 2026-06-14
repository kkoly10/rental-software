import Image from "next/image";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getThemeSettings } from "@/lib/data/theme-settings";
import { getReadyAssetCount } from "@/lib/data/storefront-counts";
import { getStorefrontDefaults, withArea } from "@/lib/verticals/storefront-defaults";
import { getTranslator } from "@/lib/i18n/server";

/**
 * Full-bleed editorial hero — the photo fills the viewport width with
 * white headline + lede overlaid on a subtle dark legibility gradient.
 * The availability bar lives directly below on cream, full-width within
 * the container. On mobile the photo aspect tightens to 4:5 and the
 * availability bar stacks (date / ZIP / full-width black CTA).
 *
 * Replaces the previous asymmetric 5fr/7fr split. The user-suggested
 * full-bleed pattern matches Peerspace, RH, Found Rentals — the
 * premium reference points in docs/design/storefront-editorial.md §10.
 *
 * The dark bottom-fade overlay is the one explicit revision to the
 * spec's #1 anti-pattern ("no overlay gradient"): a neutral dark
 * vignette for typography legibility is categorically different from
 * a saturated brand gradient banner. Same exemption that lets
 * .st-vibe-caption use text-shadow on the browse tiles.
 */
/**
 * Optional per-section content overrides supplied by the storefront page
 * document (PR-1c). When a prop is provided it wins; when ABSENT the hero falls
 * back to EXACTLY today's getOrganizationSettings()/vertical-default logic, so
 * an org with no document — or a document with no hero settings — renders
 * byte-for-byte what it does today.
 */
export type PartyClassicHeroProps = {
  headline?: string;
  message?: string;
  imageUrl?: string;
};

export async function PartyClassicHero({
  headline,
  message,
  imageUrl,
}: PartyClassicHeroProps = {}) {
  const [settings, theme, readyCount, defaults, { messages: m, t }] = await Promise.all([
    getOrganizationSettings(),
    getThemeSettings(),
    getReadyAssetCount(),
    getStorefrontDefaults(),
    getTranslator(),
  ]);

  // Document override (when present) takes priority over the legacy org setting;
  // absent → identical to today.
  const docHeadline = headline?.trim();
  const operatorHeadline = docHeadline || (settings.heroHeadline?.trim() ?? "");
  const headlineLead = operatorHeadline || defaults.headlineLead;
  const headlineItalic = operatorHeadline ? "" : defaults.headlineItalic;

  const docMessage = message?.trim();
  const lede =
    docMessage ||
    settings.websiteMessage?.trim() ||
    withArea(defaults.lede, settings.serviceAreaLabel);

  const heroImage =
    imageUrl?.trim() || settings.heroImageUrl?.trim() || defaults.heroImagePath;

  // Live availability chip — operator-controlled toggle. Rendered when
  // the operator's enabled it AND there's actually inventory available.
  // (We do NOT show a star "rating" here: storefront testimonials are
  // operator-authored, so presenting them as an aggregate review score
  // would be misleading. Real review aggregates belong to verified
  // sources only.)
  const showLiveChip = theme.availabilityChipVisible && readyCount > 0;

  const showSecondaryCta = theme.ctaSecondary === "request_quote";

  return (
    <>
      <section className="st-hero" aria-label={`${settings.businessName || "Korent"} storefront hero`}>
        <div className="st-hero-photo">
          <Image
            src={heroImage}
            alt={`${settings.businessName || "Korent"} event setup`}
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
          <div className="st-hero-scrim" aria-hidden="true" />
        </div>

        <div className="st-container st-hero-content">
          {showLiveChip && (
            <span className="st-hero-live-chip">
              {t(m.storefront.hero.liveChip, { count: readyCount })}
            </span>
          )}

          <h1 className="st-h1">
            {headlineLead}
            {headlineItalic && (
              <>
                {" "}
                <em>{headlineItalic}</em>
              </>
            )}
          </h1>

          <p className="st-lede">{lede}</p>
        </div>
      </section>

      <section className="st-container st-hero-actions" aria-label="Check availability">
        <form action="/inventory" className="st-avail" role="search">
          <label className="st-avail-field">
            <span className="st-eyebrow">{m.storefront.hero.eventDate}</span>
            <input
              name="date"
              type="date"
              autoComplete="off"
              className="st-avail-input"
            />
          </label>
          <label className="st-avail-field">
            <span className="st-eyebrow">{m.storefront.hero.deliveryZip}</span>
            <input
              name="zip"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={10}
              pattern="[0-9-]*"
              placeholder={m.storefront.hero.zipPlaceholder}
              className="st-avail-input"
            />
          </label>
          <button type="submit" className="st-avail-go">
            {m.storefront.hero.checkAvailability}
          </button>
        </form>

        <div className="st-hero-cta-row">
          <a href="#catalog" className="st-text-link">
            {m.storefront.hero.browseCatalogCta} →
          </a>
          {showSecondaryCta && (
            <a href="/contact" className="st-text-link">
              {m.storefront.hero.requestQuoteCta} →
            </a>
          )}
        </div>
      </section>
    </>
  );
}
