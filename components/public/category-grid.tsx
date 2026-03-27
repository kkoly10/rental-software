import Link from "next/link";

const categories = [
  {
    title: "Bounce Houses",
    startingPrice: "Starting $149",
    href: "/inventory?category=bounce-houses",
    image:
      "https://unsplash.com/photos/a-red-inflatable-castle-bounce-house-on-a-grassy-lawn-a_hMEPZUmOM/download?force=true&w=1200",
  },
  {
    title: "Water Slides",
    startingPrice: "Starting $199",
    href: "/inventory?category=water-slides",
    image:
      "https://unsplash.com/photos/an-aerial-view-of-an-inflatable-water-slide-zD1vrOiZbHY/download?force=true&w=1200",
  },
  {
    title: "Obstacle Courses",
    startingPrice: "Starting $249",
    href: "/inventory?category=obstacle-courses",
    image:
      "https://unsplash.com/photos/a-woman-is-playing-in-an-inflatable-park--IYY9bkSCAg/download?force=true&w=1200",
  },
  {
    title: "Party Packages",
    startingPrice: "Starting $299",
    href: "/inventory?category=packages",
    image:
      "https://unsplash.com/photos/a-decorated-event-space-with-tables-and-balloons-Cfz5r15fKdU/download?force=true&w=1200",
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