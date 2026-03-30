import Link from "next/link";

const categories = [
  {
    title: "Bounce Houses",
    startingPrice: "Starting $149",
    href: "/inventory?category=bounce-houses",
    image:
      "https://images.unsplash.com/photo-1578430554430-1c59f56bd817?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Water Slides",
    startingPrice: "Starting $199",
    href: "/inventory?category=water-slides",
    image:
      "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Obstacle Courses",
    startingPrice: "Starting $249",
    href: "/inventory?category=obstacle-courses",
    image:
      "https://images.unsplash.com/photo-1633846804415-78105890e73f?auto=format&fit=crop&w=800&q=80",
  },
  {
    title: "Party Packages",
    startingPrice: "Starting $299",
    href: "/inventory?category=packages",
    image:
      "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?auto=format&fit=crop&w=800&q=80",
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
              <div className="category-photo-img">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={category.image}
                  alt={category.title}
                  className="category-photo-img-el"
                />
              </div>
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
