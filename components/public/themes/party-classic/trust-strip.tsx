import { getContentSettings } from "@/lib/data/content-settings";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getStorefrontDefaults, withArea } from "@/lib/verticals/storefront-defaults";

/**
 * Editorial trust band — three short pillars between hairline rules.
 * NO icons. NO emoji. NO card backgrounds. Each pillar is a tracked
 * uppercase kicker + a single serif statement, vertical-default unless
 * the operator has curated trust badges via content settings.
 *
 * Per the spec at docs/design/storefront-editorial.md §5.3 + #2 of the
 * forbidden anti-patterns.
 */
/**
 * Optional per-section content override from the storefront page document
 * (PR-1d). When `badges` is provided it wins; when ABSENT the strip falls back
 * to EXACTLY today's getContentSettings().trustBadges / vertical-default logic,
 * so an org with no document renders byte-for-byte what it does today.
 */
export type PartyClassicTrustStripProps = {
  badges?: { title: string; description: string }[];
};

export async function PartyClassicTrustStrip({
  badges: badgesProp,
}: PartyClassicTrustStripProps = {}) {
  const [contentSettings, settings, defaults] = await Promise.all([
    getContentSettings(),
    getOrganizationSettings(),
    getStorefrontDefaults(),
  ]);

  // Document override (when present and non-empty) takes priority; otherwise the
  // legacy operator-curated badges, otherwise the vertical defaults.
  const curated =
    badgesProp && badgesProp.length > 0 ? badgesProp : contentSettings.trustBadges;

  // Operator-curated badges (legacy shape: {title, description}) win.
  // We treat `title` as the kicker and `description` as the statement
  // for backward compatibility — the dashboard settings UI can be
  // updated in a follow-up to expose the kicker/statement split.
  const badges =
    curated.length > 0
      ? curated
          .slice(0, 3)
          .map((b) => ({ kicker: b.title, statement: b.description }))
      : defaults.trustBadges.map((b) => ({
          kicker: b.kicker,
          statement: withArea(b.statement, settings.serviceAreaLabel),
        }));

  return (
    <section className="st-trust">
      <div className="st-container st-trust-grid">
        {badges.slice(0, 3).map((b, i) => (
          <div key={`${b.kicker}-${i}`} className="st-trust-item">
            <span className="st-eyebrow">{b.kicker}</span>
            <p className="st-trust-statement">{b.statement}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
