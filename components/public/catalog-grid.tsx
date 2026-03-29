import Link from "next/link";
import { getStorefrontFallbackImage } from "@/lib/media/storefront-fallback-images";

const categories = [
  {
    title: "Bounce Houses",
    startingPrice: "Starting $149",
    href: "/inventory?category=bounce-houses",
    slug: "castle-bouncer",
    category: "Bounce House",
  },
  {
    title: "Water Slides",
    startingPrice: "Starting $199",
    href: "/inventory?category=water-slides",
    slug: "mega-splash-water-slide",
    category: "Water Slide",
  },
  {
    title: "Obstacle Courses",
    startingPrice: "Starting $249",
    href: "/inventory?category=obstacle-courses",
    slug: "obstacle-course",
    category: "Obstacle Course",
  },
  {
    title: "Party Packages",
    startingPrice: "Starting $299",
    href: "/inventory?category=packages",
    slug: "party-package",
    category: "Party Package",
  },
] as const;

export function CategoryGrid() {
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
              key={category.title}
              href={category.href}
              className="category-photo-card"
            >
              <div
                className="category-photo-img"
                style={{
                  backgroundImage: `url(${getStorefrontFallbackImage(
                    category.slug,
                    category.category
                  )})`,
                }}
              />
              <div className="category-photo-body">
                <h3>{category.title}</h3>
                <p className="category-starting-price">
                  {category.startingPrice}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}