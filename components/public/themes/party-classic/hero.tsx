import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getContentSettings } from "@/lib/data/content-settings";
import { getThemeSettings } from "@/lib/data/theme-settings";
import { getStorefrontDefaults, withArea } from "@/lib/verticals/storefront-defaults";
import { getTranslator } from "@/lib/i18n/server";

/**
 * Editorial hero — asymmetric grid (5fr text / 7fr photo) on desktop,
 * stacked on mobile. One specific headline (vertical-default unless
 * the operator overrides), one lede, a flat hairline availability bar,
 * one underlined text-link CTA. NO carousel, NO stats row, NO floating
 * card overlay, NO orange gradient anywhere.
 *
 * Per the spec at docs/design/storefront-editorial.md §5.2.
 */
export async function PartyClassicHero() {
  const [settings, content, theme, defaults, { messages: m }] = await Promise.all([
    getOrganizationSettings(),
    getContentSettings(),
    getThemeSettings(),
    getStorefrontDefaults(),
    getTranslator(),
  ]);

  // Headline + italic accent. Operator override (settings.heroHeadline)
  // wins entirely (renders as a single non-italic phrase). Otherwise we
  // split into a lead + italic accent per vertical defaults.
  const operatorHeadline = settings.heroHeadline?.trim() ?? "";
  const headlineLead = operatorHeadline || defaults.headlineLead;
  const headlineItalic = operatorHeadline ? "" : defaults.headlineItalic;

  const lede =
    settings.websiteMessage?.trim() ||
    withArea(defaults.lede, settings.serviceAreaLabel);

  const heroImage = settings.heroImageUrl?.trim() || defaults.heroImagePath;

  // Rating chip surfaces only with credible signal — same gate as before.
  const testimonialCount = content.testimonials.length;
  const ratingSum = content.testimonials.reduce(
    (sum, t) => sum + (typeof t.rating === "number" ? Math.max(0, Math.min(5, t.rating)) : 0),
    0
  );
  const avgRating = testimonialCount > 0 ? ratingSum / testimonialCount : 0;
  const showRating = testimonialCount >= 3 && avgRating >= 4;

  const showSecondaryCta = theme.ctaSecondary === "request_quote";

  return (
    <section className="st-container st-hero">
      <div className="st-hero-copy">
        {showRating && (
          <span className="st-hero-rating-chip">
            <span className="st-hero-rating-chip-star">★</span>
            <strong>{avgRating.toFixed(1)}</strong>
            <span>· {testimonialCount}+ reviews</span>
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

        <form action="/inventory" className="st-avail" aria-label="Check availability">
          <label className="st-avail-field">
            <span className="st-eyebrow">{m.storefront.hero.eventDate}</span>
            <input name="date" type="date" className="st-avail-input" />
          </label>
          <label className="st-avail-field">
            <span className="st-eyebrow">{m.storefront.hero.deliveryZip}</span>
            <input
              name="zip"
              type="text"
              inputMode="numeric"
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
            Or browse the full catalog →
          </a>
          {showSecondaryCta && (
            <a href="/contact" className="st-text-link">
              {m.storefront.hero.requestQuoteCta} →
            </a>
          )}
        </div>
      </div>

      <div className="st-hero-photo">
        {/* Inline <img> not next/image — these are vendored, ≤500 KB
            files served from /public; next/image's optimizer adds
            cost we don't need for a single hero per page. */}
        <img
          src={heroImage}
          alt={`${settings.businessName || "Korent"} event setup`}
          width={1600}
          height={2000}
          fetchPriority="high"
        />
      </div>
    </section>
  );
}
