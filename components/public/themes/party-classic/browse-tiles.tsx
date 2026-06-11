import Link from "next/link";
import { getStorefrontDefaults } from "@/lib/verticals/storefront-defaults";
import { SectionHead } from "./section-head";

/**
 * Editorial "Browse by occasion" — three full-bleed tiles with a small
 * tracked-uppercase kicker and a display-serif label, overlaid on the
 * tile photo using text-shadow for legibility (the one allowed
 * typographic shadow — see anti-pattern #6 in the spec).
 *
 * Tiles come from the vertical's storefrontDefaults. Operator-level
 * overrides will land in a follow-up content-settings field.
 */
export async function PartyClassicBrowseTiles() {
  const defaults = await getStorefrontDefaults();
  const tiles = defaults.vibeTiles;

  return (
    <section className="st-section">
      <div className="st-container">
        <SectionHead
          kicker="Browse by occasion"
          title="Made for the day, planned for the year."
          link={{ label: "All categories →", href: "/inventory" }}
        />
        <div className="st-vibes-grid">
          {tiles.map((t) => (
            <Link key={t.label} href={t.href} className="st-vibe">
              <img src={t.imagePath} alt={t.label} loading="lazy" />
              <span className="st-vibe-caption">
                <small>{t.kicker}</small>
                {t.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
