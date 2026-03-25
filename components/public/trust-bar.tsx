const trustItems = [
  {
    title: "Fully Insured & Licensed",
    description: "Professional setup with parent-first trust.",
  },
  {
    title: "Cleaned & Sanitized",
    description: "Units are cleaned between rentals.",
  },
  {
    title: "On-Time Delivery",
    description: "Reliable drop-off, setup, and pickup windows.",
  },
  {
    title: "Setup & Pack Down",
    description: "We handle the heavy lifting so you can enjoy the party.",
  },
] as const;

export function TrustBar() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="panel" style={{ padding: 20 }}>
          <div className="grid grid-4">
            {trustItems.map((item) => (
              <article key={item.title} className="order-card">
                <strong>{item.title}</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  {item.description}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
