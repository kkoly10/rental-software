const trustItems = [
  {
    icon: "🛡️",
    bg: "#edf4ff",
    title: "Fully Insured & Licensed",
    description: "Professional setup with parent-first trust.",
  },
  {
    icon: "✨",
    bg: "#eaf9f4",
    title: "Cleaned & Sanitized",
    description: "Units are cleaned between every rental.",
  },
  {
    icon: "⏱️",
    bg: "#fff4e5",
    title: "On-Time Delivery",
    description: "Reliable drop-off, setup, and pickup windows.",
  },
  {
    icon: "🛠️",
    bg: "#f5f0ff",
    title: "Free Set Up & Takedown",
    description: "We handle the heavy lifting so you enjoy the party.",
  },
] as const;

export function TrustBar() {
  return (
    <section className="trust-bar-section">
      <div className="container">
        <p className="trust-bar-heading">Trusted by families like yours</p>
        <div className="trust-items">
          {trustItems.map((item) => (
            <div key={item.title} className="trust-item">
              <div className="trust-icon" style={{ background: item.bg }}>
                {item.icon}
              </div>
              <div className="trust-item-text">
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
