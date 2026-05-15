import Link from "next/link";
import { getCategoryGridItems } from "@/lib/data/category-grid";
import { getPlaceholderImage } from "@/lib/utils/placeholders";
import { getTranslator } from "@/lib/i18n/server";

export async function CategoryGrid() {
  const [categories, { messages: m, t }] = await Promise.all([
    getCategoryGridItems(),
    getTranslator(),
  ]);

  if (categories.length === 0) return null;

  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <div>
            <div className="kicker">{m.storefront.categoryGrid.kicker}</div>
            <h2>{m.storefront.categoryGrid.title}</h2>
            <div className="muted">
              {m.storefront.categoryGrid.description}
            </div>
          </div>
        </div>

        <div className="category-photo-grid">
          {categories.map((category) => (
            <Link
              key={category.slug}
              href={`/inventory?category=${category.slug}`}
              className="category-photo-card"
            >
              <div className="category-photo-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={category.imageUrl || getPlaceholderImage(category.name)}
                  alt={category.name}
                  className="category-photo-img-el"
                />
              </div>
              <div className="category-photo-body">
                <h3>{category.name}</h3>
                {category.startingPrice != null && (
                  <p className="category-starting-price">
                    {t(m.storefront.categoryGrid.startingPrice, { amount: category.startingPrice })}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
