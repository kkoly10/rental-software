import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getContentSettings } from "@/lib/data/content-settings";
import { getThemeSettings } from "@/lib/data/theme-settings";
import { getReadyAssetCount } from "@/lib/data/storefront-counts";
import { getCategoryGridItems } from "@/lib/data/category-grid";
import { getTranslator } from "@/lib/i18n/server";

// Bouncy castle photo at hero resolution. Re-uses the same Unsplash
// photo id the storefront's "bounce" product fallback already uses
// (lib/media/storefront-fallback-images.ts) so we keep a single source
// of party imagery.
const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=1400&q=85";

// Unsplash photo ids that used to be defaults but have since been removed
// from Unsplash (HTTP 404). Tenants provisioned while those were the
// defaults have the dead URL persisted in organizations.settings
// .hero_image_url, so swapping the constant above is not enough — we
// also need to ignore the dead URL at render time and fall through to
// DEFAULT_HERO_IMAGE.
const DEAD_HERO_PHOTO_IDS = ["1607113284254-1ab1f6b48e21"] as const;

function isDeadHeroUrl(url: string): boolean {
  return DEAD_HERO_PHOTO_IDS.some((id) => url.includes(id));
}

export async function PartyClassicHero() {
  const [settings, content, theme, readyCount, categories, { messages: m, t }] = await Promise.all([
    getOrganizationSettings(),
    getContentSettings(),
    getThemeSettings(),
    getReadyAssetCount(),
    getCategoryGridItems(),
    getTranslator(),
  ]);

  // Derive the cheapest real "from" price across categories — hide the
  // hero stat entirely when we have no real price.
  const realPrices = categories
    .map((c) => c.startingPrice)
    .filter((p): p is number => typeof p === "number" && p > 0);
  const fromPrice = realPrices.length > 0 ? Math.min(...realPrices) : null;

  // Need at least 3 ratings averaging ≥4 to surface a rating block.
  const testimonialCount = content.testimonials.length;
  const ratingSum = content.testimonials.reduce(
    (sum, t) => sum + (typeof t.rating === "number" ? Math.max(0, Math.min(5, t.rating)) : 0),
    0
  );
  const avgRating = testimonialCount > 0 ? ratingSum / testimonialCount : 0;
  const showRating = testimonialCount >= 3 && avgRating >= 4;

  const headlineRaw = settings.heroHeadline || m.storefront.hero.defaultHeadline;
  const storedHero = settings.heroImageUrl?.trim() ?? "";
  const heroImage =
    storedHero && !isDeadHeroUrl(storedHero) ? storedHero : DEFAULT_HERO_IMAGE;
  const showLiveChip = theme.availabilityChipVisible && readyCount > 0;
  const showSecondaryCta = theme.ctaSecondary === "request_quote";

  return (
    <section className="st-container st-hero">
      <div className="st-hero-text">
        {showRating ? (
          <div className="st-hero-rating-chip">
            <span className="st-hero-rating-chip-stars">★★★★★</span>
            <strong>{avgRating.toFixed(1)}</strong>
            <span className="st-hero-rating-chip-meta">
              · {testimonialCount}+ reviews
            </span>
          </div>
        ) : showLiveChip ? (
          <span className="st-live-chip">
            {t(m.storefront.hero.liveChip, { count: readyCount })}
          </span>
        ) : null}

        <h1 className="st-h1">{headlineRaw}</h1>
        <p className="st-hero-sub">
          {settings.websiteMessage || m.storefront.hero.defaultMessage}
        </p>

        <div className="st-hero-stats">
          <div>
            <div className="st-hero-stat-value">Included</div>
            <div className="st-hero-stat-label">Delivery + setup</div>
          </div>
          {fromPrice !== null && (
            <div>
              <div className="st-hero-stat-value">${fromPrice}/day</div>
              <div className="st-hero-stat-label">Starting at</div>
            </div>
          )}
          <div>
            <div className="st-hero-stat-value">Quotes</div>
            <div className="st-hero-stat-label">Same-day</div>
          </div>
        </div>
      </div>

      <div className="st-hero-visual">
        <div className="st-hero-photo-frame">
          <img
            src={heroImage}
            alt={`${settings.businessName} event setup`}
            className="st-hero-photo"
            width="1400"
            height="1120"
            fetchPriority="high"
          />
        </div>

        {/* Floating booking card overhangs the photo on desktop;
            drops back inline below on mobile (see CSS). */}
        <form action="/inventory" className="st-av-card">
          <div className="st-av-card-title">Check availability for your date</div>
          <div className="st-av-row">
            <label className="st-av-field">
              <span className="st-av-field-label">{m.storefront.hero.eventDate}</span>
              <input name="date" type="date" />
            </label>
            <label className="st-av-field">
              <span className="st-av-field-label">{m.storefront.hero.deliveryZip}</span>
              <input name="zip" type="text" placeholder={m.storefront.hero.zipPlaceholder} inputMode="numeric" />
            </label>
            <button type="submit" className="st-av-go" aria-label={m.storefront.hero.checkOpenCta}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          {showSecondaryCta && (
            <div className="st-av-actions">
              <a href="/contact" className="st-av-quote">
                {m.storefront.hero.requestQuoteCta}
              </a>
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
