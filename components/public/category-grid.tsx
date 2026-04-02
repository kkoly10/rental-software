import Link from "next/link";
import { getCategoryGridItems } from "@/lib/data/category-grid";

export async function CategoryGrid() {
  const categories = await getCategoryGridItems();

  if (categories.length === 0) return null;

  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <div>
            <div className="kicker">Explore by category</div>
            <h2>Find the right party setup faster</h2>
            <div className="muted">
              Browse by type before diving into specific rentals.
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
                {category.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={category.imageUrl}
                    alt={category.name}
                    className="category-photo-img-el"
                  />
                ) : (
                  <div
                    className="category-photo-img-el"
                    style={{
                      background: "var(--surface-muted)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-soft)",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {category.name}
                  </div>
                )}
              </div>
              <div className="category-photo-body">
                <h3>{category.name}</h3>
                {category.startingPrice != null && (
                  <p className="category-starting-price">
                    Starting ${category.startingPrice}
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
