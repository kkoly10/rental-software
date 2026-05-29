import Link from "next/link";
import { getCategoryGridItems } from "@/lib/data/category-grid";
import { getThemeSettings } from "@/lib/data/theme-settings";
import { getPlaceholderImage } from "@/lib/utils/placeholders";
import { getTranslator } from "@/lib/i18n/server";

export async function PartyClassicCategoryTiles() {
  const [categories, theme, { messages: m, t }] = await Promise.all([
    getCategoryGridItems(),
    getThemeSettings(),
    getTranslator(),
  ]);

  if (categories.length === 0) return null;

  // Cap displayed tiles at 6 (D-style 3-up rows on desktop, 2-up on mobile);
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
          {t(m.storefront.categoryGrid.viewAllWithCount, { count: categories.length })}
        </Link>
      </div>

      {showChipRail && (
        <div className="st-chip-rail">
          <Link href="/inventory" className="st-chip active">
            {m.storefront.themeChips.all}
          </Link>
          {display.map((cat) => (
            <Link
              key={cat.slug}
              href={`/inventory?category=${cat.slug}`}
              className="st-chip"
            >
              {cat.themeEmoji ? `${cat.themeEmoji} ${cat.name}` : cat.name}
            </Link>
          ))}
        </div>
      )}

      <div className="st-cat-grid">
        {display.map((cat) => {
          const imageUrl = cat.imageUrl ?? getPlaceholderImage(cat.slug);
          const subParts: string[] = [];
          if (cat.startingPrice !== null) {
            subParts.push(t(m.storefront.categoryGrid.startingPrice, { amount: String(cat.startingPrice) }));
          }
          subParts.push(t(m.storefront.categoryGrid.optionCount, { count: cat.productCount }));
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
                {t(m.storefront.categoryGrid.optionCount, { count: cat.productCount })}
              </div>
              <div className="st-cat-tile-content">
                <h3 className="st-cat-tile-name">{cat.name}</h3>
                <div className="st-cat-tile-sub">{subParts.join(" · ")}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
