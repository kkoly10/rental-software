const features = [
  {
    kicker: "Booking calendar",
    title: "See every event at a glance",
    description:
      "Color-coded month view shows confirmed bookings, pending inquiries, and blocked dates. Never double-book again.",
    visual: "calendar",
    gradient: "linear-gradient(135deg, #eef4ff 0%, #d8e7ff 100%)",
  },
  {
    kicker: "Order pipeline",
    title: "Track orders from inquiry to delivery",
    description:
      "Every booking flows through a clear pipeline — inquiry, quote, deposit, confirmed, delivered, completed. Nothing falls through the cracks.",
    visual: "orders",
    gradient: "linear-gradient(135deg, #eaf9f4 0%, #d0f0e4 100%)",
  },
  {
    kicker: "Online checkout",
    title: "Let customers book while you sleep",
    description:
      "A branded public storefront with live availability. Customers pick a date, choose their rentals, and submit — no phone calls required.",
    visual: "checkout",
    gradient: "linear-gradient(135deg, #fff4e5 0%, #ffe8cc 100%)",
  },
];

function FeatureVisual({ type, gradient }: { type: string; gradient: string }) {
  return (
    <div className="feature-visual" style={{ background: gradient }}>
      <div className="feature-mockup">
        <div className="feature-mockup-bar">
          <span /><span /><span />
        </div>
        {type === "calendar" && (
          <div className="feature-mockup-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
              {["S","M","T","W","T","F","S"].map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 9, color: "#8899b3", fontWeight: 600, padding: "3px 0" }}>{d}</div>
              ))}
              {Array.from({ length: 35 }, (_, i) => {
                const day = i - 2;
                const hasEvent = [5, 12, 13, 19, 24, 25].includes(day);
                const isBlock = day === 20;
                return (
                  <div key={i} style={{
                    height: 22,
                    borderRadius: 4,
                    background: day < 1 || day > 30 ? "transparent" : isBlock ? "#fdeaea" : hasEvent ? "#eaf9f4" : "#f8fafd",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 8, color: isBlock ? "#c33" : hasEvent ? "#188862" : "#8899b3",
                    fontWeight: hasEvent || isBlock ? 700 : 400,
                  }}>
                    {day >= 1 && day <= 30 ? day : ""}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {type === "orders" && (
          <div className="feature-mockup-body">
            {[
              { name: "Johnson Family", status: "Confirmed", color: "#188862", bg: "#eaf9f4" },
              { name: "River Church", status: "Awaiting Deposit", color: "#a86a08", bg: "#fff4e5" },
              { name: "Smith Birthday", status: "Delivered", color: "#188862", bg: "#eaf9f4" },
              { name: "PTA Fall Festival", status: "Quote Sent", color: "#a86a08", bg: "#fff4e5" },
            ].map((order) => (
              <div key={order.name} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "6px 8px", borderRadius: 6, background: "#f8fafd", marginBottom: 4,
              }}>
                <span style={{ fontSize: 9, fontWeight: 600, color: "#1b2554" }}>{order.name}</span>
                <span style={{ fontSize: 8, padding: "2px 6px", borderRadius: 4, background: order.bg, color: order.color, fontWeight: 700 }}>{order.status}</span>
              </div>
            ))}
          </div>
        )}
        {type === "checkout" && (
          <div className="feature-mockup-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 6 }}>
              <div style={{ padding: 6, borderRadius: 6, background: "#f8fafd", textAlign: "center" }}>
                <div style={{ height: 28, borderRadius: 4, background: "linear-gradient(135deg, #dcecff, #8fc5ff)", marginBottom: 4 }} />
                <div style={{ fontSize: 8, fontWeight: 600, color: "#1b2554" }}>Bounce House</div>
                <div style={{ fontSize: 7, color: "#8899b3" }}>$149/day</div>
              </div>
              <div style={{ padding: 6, borderRadius: 6, background: "#f8fafd", textAlign: "center" }}>
                <div style={{ height: 28, borderRadius: 4, background: "linear-gradient(135deg, #ffe8cc, #ffd299)", marginBottom: 4 }} />
                <div style={{ fontSize: 8, fontWeight: 600, color: "#1b2554" }}>Water Slide</div>
                <div style={{ fontSize: 7, color: "#8899b3" }}>$199/day</div>
              </div>
            </div>
            <div style={{ padding: "5px 8px", borderRadius: 6, background: "#f97316", textAlign: "center" }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: "white" }}>Book Now</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function FeatureShowcase() {
  return (
    <section className="section">
      <div className="container">
        <div style={{ textAlign: "center", maxWidth: 580, margin: "0 auto 36px" }}>
          <div className="kicker">Platform preview</div>
          <h2 style={{ margin: "8px 0 0" }}>
            See what you get on day one
          </h2>
        </div>

        <div className="feature-showcase-list">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="feature-showcase-row"
              style={{
                flexDirection: index % 2 === 0 ? "row" : "row-reverse",
              }}
            >
              <div className="feature-showcase-copy">
                <div className="kicker">{feature.kicker}</div>
                <h3 style={{ margin: "8px 0 12px", fontSize: "1.35rem" }}>
                  {feature.title}
                </h3>
                <p className="muted" style={{ margin: 0, lineHeight: 1.65, fontSize: "1rem" }}>
                  {feature.description}
                </p>
              </div>
              <FeatureVisual type={feature.visual} gradient={feature.gradient} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
