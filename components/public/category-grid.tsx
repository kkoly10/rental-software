import Link from "next/link";

const categories = [
  {
    title: "Bounce Houses",
    startingPrice: "Starting $149",
    href: "/inventory?category=bounce-houses",
    image:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=380&fit=crop&auto=format",
  },
  {
    title: "Water Slides",
    startingPrice: "Starting $199",
    href: "/inventory?category=water-slides",
    image:
      "https://images.unsplash.com/photo-1529156069898-dc8d2ed57fb2?w=600&h=380&fit=crop&auto=format",
  },
  {
    title: "Obstacle Courses",
    startingPrice: "Starting $249",
    href: "/inventory?category=obstacle-courses",
    image:
      "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=600&h=380&fit=crop&auto=format",
  },
  {
    title: "Party Packages",
    startingPrice: "Starting $299",
    href: "/inventory?category=packages",
    image:
      "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=600&h=380&fit=crop&auto=format",
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
                style={{ backgroundImage: `url(${category.image})` }}
              />
              <div className="category-photo-body">
                <h3>{category.title}</h3>
                <p className="category-starting-price">{category.startingPrice}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
