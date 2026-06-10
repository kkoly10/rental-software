import { getContentSettings } from "@/lib/data/content-settings";
import { getTranslator } from "@/lib/i18n/server";

const DEFAULT_ICONS: Array<(props: { className?: string }) => React.ReactNode> = [
  // Shield (insured)
  () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" />
    </svg>
  ),
  // Clock (on-time)
  () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  // Sparkles (loved by families)
  () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
      <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8z" />
    </svg>
  ),
  // Pricing / lines (fallback)
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

  const badges =
    contentSettings.trustBadges.length > 0
      ? contentSettings.trustBadges
      : m.storefront.trust.defaults;

  // Carnival theme shows three trust pillars (mockup design).
  // If the operator curated more, the extras are dropped from the
  // homepage — they remain visible on dedicated trust pages.
  const displayed = badges.slice(0, 3);

  return (
    <section className="st-trust">
      <div className="st-container st-trust-inner">
        {displayed.map((badge, i) => {
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
