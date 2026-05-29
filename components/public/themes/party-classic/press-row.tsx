import { getThemeSettings } from "@/lib/data/theme-settings";
import { getTranslator } from "@/lib/i18n/server";
import { sanitizeHref } from "@/lib/utils/safe-href";

/**
 * Optional "As seen on" press logos row. Hidden when no logos are
 * configured or the operator has turned off vis.press_row. Logos are
 * text-only wordmarks — operators paste the outlet name (no image
 * upload needed) and we typographically render it in a quiet style.
 */
export async function PartyClassicPressRow() {
  const [theme, { messages: m }] = await Promise.all([
    getThemeSettings(),
    getTranslator(),
  ]);

  if (!theme.pressRowVisible || theme.pressLogos.length === 0) {
    return null;
  }

  return (
    <section className="st-container st-press">
      <span className="st-press-label">{m.storefront.press.label}</span>
      <div className="st-press-logos">
        {theme.pressLogos.map((logo, i) => {
          // Alternate sans / serif so a string of logos doesn't look monotone
          const serifIndex = i % 2 === 1;
          const className = `st-press-logo${serifIndex ? "" : " sans"}`;
          if (logo.href) {
            return (
              <a
                key={`${logo.label}-${i}`}
                href={sanitizeHref(logo.href)}
                target="_blank"
                rel="noopener noreferrer"
                className={className}
              >
                {logo.label}
              </a>
            );
          }
          return (
            <span key={`${logo.label}-${i}`} className={className}>
              {logo.label}
            </span>
          );
        })}
      </div>
    </section>
  );
}
