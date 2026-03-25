import Link from "next/link";

const categories = [
  {
    title: "Bounce Houses",
    description: "Classic backyard favorites for birthdays and neighborhood parties.",
    href: "/inventory?category=bounce-houses",
  },
  {
    title: "Water Slides",
    description: "High-energy rentals for summer events and larger family gatherings.",
    href: "/inventory?category=water-slides",
  },
  {
    title: "Obstacle Courses",
    description: "Perfect for schools, churches, and competitive party fun.",
    href: "/inventory?category=obstacle-courses",
  },
  {
    title: "Packages",
    description: "Bundle inflatables with add-ons for a smoother booking experience.",
    href: "/inventory?category=packages",
  },
  {
    title: "Add-ons",
    description: "Generators, tables, chairs, and support items for full event setup.",
    href: "/inventory?category=add-ons",
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
            <div className="muted">Browse by event type before diving into specific rentals.</div>
          </div>
        </div>

        <div className="grid grid-3">
          {categories.map((category) => (
            <Link key={category.title} href={category.href} className="product-card">
              <div className="product-media" style={{ height: 210 }} />
              <div className="product-copy">
                <div className="kicker">Category</div>
                <h3 style={{ margin: "8px 0 6px" }}>{category.title}</h3>
                <div className="muted">{category.description}</div>
                <div style={{ marginTop: 16 }}>
                  <span className="secondary-btn">Browse {category.title}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
