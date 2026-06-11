import Link from "next/link";
import { getCategoryGridItems } from "@/lib/data/category-grid";
import { getThemeSettings } from "@/lib/data/theme-settings";
import { getStorefrontFallbackImage } from "@/lib/media/storefront-fallback-images";
import { prettifyCategoryName } from "@/lib/utils/prettify-category";
import { getTranslator } from "@/lib/i18n/server";

export async function PartyClassicCategoryTiles() {
  const [categories, theme, { messages: m, t }] = await Promise.all([
    getCategoryGridItems(),
    getThemeSettings(),
    getTranslator(),
  ]);

  if (categories.length === 0) return null;

  // Cap displayed tiles at 6 (3-up rows on desktop);
  // operators with bigger catalogs see the "View all" link.
  const display = categories.slice(0, 6);
  const showChipRail = theme.themeChipRailVisible && theme.themeChipsEnabled;

  return (
    <section className="st-container st-section">
      <div className="st-section-head">
        <div>
          <h2 className="st-section-title">{m.storefront.categoryGrid.title}</h2>
          <p className="st-section-sub">{m.storefront.categoryGrid.description}</p>
        </div>
        <Link href="/inventory" className="st-section-link">
          {/* "View all 2 →" reads silly for tiny catalogs — only surface
              the count when there are more categories than we render. */}
          {categories.length > display.length
            ? t(m.storefront.categoryGrid.viewAllWithCount, { count: categories.length })
            : m.storefront.categoryGrid.viewAll}
        </Link>
      </div>

      {showChipRail && (
        <div className="st-chip-rail">
          <Link href="/inventory" className="st-chip active">
            {m.storefront.themeChips.all}
          </Link>
          {display.map((cat) => {
            const label = prettifyCategoryName(cat.name);
            return (
              <Link
                key={cat.slug}
                href={`/inventory?category=${cat.slug}`}
                className="st-chip"
              >
                {cat.themeEmoji ? `${cat.themeEmoji} ${label}` : label}
              </Link>
            );
          })}
        </div>
      )}

      <div className="st-cat-grid">
        {display.map((cat) => {
          const label = prettifyCategoryName(cat.name);
          // Same curated fallback chain the product cards use — per-category
          // Unsplash imagery keyed off slug + name, so two categories never
          // collapse onto the same generic local placeholder PNG.
          const imageUrl =
            cat.imageUrl ?? getStorefrontFallbackImage(cat.slug, label);
          // Pill at top-left already conveys the option count; show the
          // starting price (or omit) in the bottom subtext so the two
          // never duplicate the same metric.
          const subText =
            cat.startingPrice !== null
              ? t(m.storefront.categoryGrid.startingPrice, { amount: String(cat.startingPrice) })
              : "";
          return (
            <Link
              key={cat.slug}
              href={`/inventory?category=${cat.slug}`}
              className="st-cat-tile"
            >
              <div
                className="st-cat-tile-img"
                style={{ backgroundImage: `url("${imageUrl}")` }}
              />
              <div className="st-cat-tile-overlay" />
              <div className="st-cat-tile-pill">
                {cat.productCount === 1
                  ? m.storefront.categoryGrid.optionCountOne
                  : t(m.storefront.categoryGrid.optionCount, { count: cat.productCount })}
              </div>
              <div className="st-cat-tile-content">
                <h3 className="st-cat-tile-name">{label}</h3>
                {subText && <div className="st-cat-tile-sub">{subText}</div>}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
