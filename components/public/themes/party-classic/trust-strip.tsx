import { getContentSettings } from "@/lib/data/content-settings";
import { getTranslator } from "@/lib/i18n/server";

const DEFAULT_ICONS: Array<(props: { className?: string }) => React.ReactNode> = [
  // Insured / shield
  () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
    </svg>
  ),
  // Cleaned / checkmark
  () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  // On-time / clock
  () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  // Pricing / lines
  () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 12h18M3 6h18M3 18h12" />
    </svg>
  ),
];

export async function PartyClassicTrustStrip() {
  const [contentSettings, { messages: m }] = await Promise.all([
    getContentSettings(),
    getTranslator(),
  ]);

  // Use operator-overridden badges if they've curated their own; otherwise
  // fall back to the i18n default set.
  const badges =
    contentSettings.trustBadges.length > 0
      ? contentSettings.trustBadges
      : m.storefront.trust.defaults;

  return (
    <section className="st-trust">
      <div className="st-container st-trust-inner">
        {badges.slice(0, 4).map((badge, i) => {
          const Icon = DEFAULT_ICONS[i] ?? DEFAULT_ICONS[0];
          return (
            <div key={`${badge.title}-${i}`} className="st-trust-item">
              <div className="st-trust-icon">
                <Icon />
              </div>
              <div>
                <div className="st-trust-title">{badge.title}</div>
                <div className="st-trust-sub">{badge.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
