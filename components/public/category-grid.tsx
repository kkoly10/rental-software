import Link from "next/link";

const categories = [
  {
    title: "Bounce Houses",
    startingPrice: "Starting $149",
    href: "/inventory?category=bounce-houses",
    image:
      "https://cdn.pixabay.com/photo/2018/07/28/00/05/bouncy-castles-3567019_1280.jpg",
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
      "https://cdn.pixabay.com/photo/2016/06/14/03/03/inflatable-obstacle-course-1455632_1280.jpg",
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
