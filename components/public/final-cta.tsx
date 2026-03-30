import Link from "next/link";

export function FinalCta() {
  return (
    <section className="section final-cta-section">
      <div className="container">
        <div className="final-cta-card">
          <div className="kicker" style={{ color: "rgba(255,255,255,0.7)" }}>
            Ready to grow?
          </div>
          <h2 style={{ color: "white", margin: "8px 0 12px", fontSize: "2rem" }}>
            Start taking bookings today
          </h2>
          <p style={{ color: "rgba(255,255,255,0.8)", margin: "0 0 28px", maxWidth: 480 }}>
            Set up your storefront in minutes. No credit card required for the free plan — upgrade when you&apos;re ready.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/signup"
              className="primary-btn"
              style={{ background: "white", color: "#1b2554", minHeight: 48, fontSize: 15 }}
            >
              Create Free Account
            </Link>
            <Link
              href="/pricing"
              className="ghost-btn"
              style={{ color: "rgba(255,255,255,0.9)", borderColor: "rgba(255,255,255,0.3)" }}
            >
              View Pricing
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
