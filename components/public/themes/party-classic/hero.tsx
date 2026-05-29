import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getThemeSettings } from "@/lib/data/theme-settings";
import { getReadyAssetCount } from "@/lib/data/storefront-counts";
import { getTranslator } from "@/lib/i18n/server";

const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1607113284254-1ab1f6b48e21?auto=format&fit=crop&w=1400&q=85";

/**
 * Split the headline into a leading clause + the final 1-2 words for the
 * italic accent. e.g. "Saturday's covered. Promise." → ["Saturday's covered.", "Promise."]
 * Falls back to no accent if the headline is a single word.
 */
function splitHeadlineForAccent(headline: string): { lead: string; accent: string } {
  const trimmed = headline.trim();
  if (!trimmed) return { lead: "", accent: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return { lead: trimmed, accent: "" };
  // Take the last word; if it's <= 4 chars and preceded by punctuation we
  // include the last two words to give the accent some weight.
  const last = parts[parts.length - 1];
  if (last.length <= 4 && parts.length >= 3 && /[.,;!?]$/.test(parts[parts.length - 2])) {
    return {
      lead: parts.slice(0, -2).join(" "),
      accent: parts.slice(-2).join(" "),
    };
  }
  return {
    lead: parts.slice(0, -1).join(" "),
    accent: last,
  };
}

export async function PartyClassicHero() {
  const [settings, theme, readyCount, { messages: m, t }] = await Promise.all([
    getOrganizationSettings(),
    getThemeSettings(),
    getReadyAssetCount(),
    getTranslator(),
  ]);

  const headlineRaw = settings.heroHeadline || m.storefront.hero.defaultHeadline;
  const { lead, accent } = splitHeadlineForAccent(headlineRaw);
  const heroImage = settings.heroImageUrl || DEFAULT_HERO_IMAGE;
  const showLiveChip = theme.availabilityChipVisible && readyCount > 0;
  const showSecondaryCta = theme.ctaSecondary === "request_quote";

  return (
    <section className="st-container st-hero">
      <div className="st-hero-text">
        {showLiveChip && (
          <span className="st-live-chip">
            {t(m.storefront.hero.liveChip, { count: readyCount })}
          </span>
        )}
        <h1 className="st-h1">
          {accent ? (
            <>
              {lead} <span className="st-h1-accent">{accent}</span>
            </>
          ) : (
            headlineRaw
          )}
        </h1>
        <p className="st-hero-sub">
          {settings.websiteMessage || m.storefront.hero.defaultMessage}
        </p>

        <form action="/inventory" className="st-av-card">
          <div className="st-av-row">
            <label className="st-av-field">
              <span className="st-av-field-label">{m.storefront.hero.eventDate}</span>
              <input name="date" type="date" />
            </label>
            <label className="st-av-field">
              <span className="st-av-field-label">{m.storefront.hero.deliveryZip}</span>
              <input name="zip" type="text" placeholder="22554" inputMode="numeric" />
            </label>
          </div>
          <div className="st-av-actions">
            <button type="submit" className="st-av-go">
              {m.storefront.hero.checkOpenCta}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
            {showSecondaryCta && (
              <a href="/contact" className="st-av-quote">
                {m.storefront.hero.requestQuoteCta}
              </a>
            )}
          </div>
        </form>

        <div className="st-social-row">
          <span className="st-stars">
            <span className="st-stars-glyphs">★★★★★</span>
            <strong>4.9</strong>
            <span>· 500+ events</span>
          </span>
          <span className="st-dot"></span>
          <span>{t(m.storefront.hero.insuredInline, { amount: "$2M" })}</span>
          <span className="st-dot"></span>
          <span>{m.storefront.hero.sameDayQuotes}</span>
        </div>
      </div>

      <div className="st-hero-visual">
        <img src={heroImage} alt={`${settings.businessName} event setup`} className="st-hero-photo" />
        <div className="st-price-pill">
          <span className="st-price-pill-from">{m.storefront.hero.priceFromLabel}</span>
          <span>$145/day</span>
        </div>
        <div className="st-delivery-pill">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          {m.storefront.hero.deliveryIncludedLabel}
        </div>
      </div>
    </section>
  );
}
