const trustItems = [
  {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    bg: "#edf4ff",
    color: "#1e5dcf",
    title: "Fully Insured",
    description: "Every event backed by commercial liability coverage.",
  },
  {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    bg: "#eaf9f4",
    color: "#188862",
    title: "Cleaned Between Events",
    description: "Sanitized and inspected after every single rental.",
  },
  {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    bg: "#fff4e5",
    color: "#a86a08",
    title: "On-Time, Every Time",
    description: "Guaranteed delivery window — or you don't pay the fee.",
  },
  {
    svg: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`,
    bg: "#f5f0ff",
    color: "#7c3aed",
    title: "Free Setup & Takedown",
    description: "We deliver, set up, and pick up — you just enjoy the party.",
  },
] as const;

export function TrustBar() {
  return (
    <section className="trust-bar-section">
      <div className="container">
        <div className="trust-items">
          {trustItems.map((item) => (
            <div key={item.title} className="trust-item">
              <div
                className="trust-icon"
                style={{ background: item.bg, color: item.color }}
                dangerouslySetInnerHTML={{ __html: item.svg }}
              />
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
