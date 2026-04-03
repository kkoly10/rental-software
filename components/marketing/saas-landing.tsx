import Link from "next/link";

/**
 * SaaS marketing landing page for the root domain (korent.app without a subdomain).
 *
 * This page targets rental business OPERATORS — not end customers.
 * End customers see the operator's storefront on tenant subdomains.
 */
export function SaasLanding() {
  return (
    <>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid var(--border, #e5e7eb)",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: "1.3rem" }}>Korent</div>
        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="#features" className="ghost-btn">
            Features
          </a>
          <a href="#pricing" className="ghost-btn">
            Pricing
          </a>
          <Link href="/login" className="secondary-btn">
            Log In
          </Link>
          <Link href="/signup" className="primary-btn">
            Start Free Trial
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section
          style={{
            textAlign: "center",
            padding: "80px 24px 60px",
            maxWidth: 800,
            margin: "0 auto",
          }}
        >
          <div
            className="kicker"
            style={{ marginBottom: 12 }}
          >
            Rental business software
          </div>
          <h1 style={{ fontSize: "2.5rem", lineHeight: 1.2, margin: "0 0 20px" }}>
            Run your inflatable rental business from one platform
          </h1>
          <p
            className="muted"
            style={{ fontSize: "1.15rem", maxWidth: 600, margin: "0 auto 32px" }}
          >
            Online booking, real-time availability, delivery routing, invoicing,
            and customer management — built specifically for party rental operators.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link href="/signup" className="primary-btn" style={{ fontSize: "1.05rem", padding: "12px 28px" }}>
              Start Free Trial
            </Link>
            <a href="#features" className="secondary-btn" style={{ fontSize: "1.05rem", padding: "12px 28px" }}>
              See Features
            </a>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          style={{
            padding: "60px 24px",
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="kicker">Everything you need</div>
            <h2>Features built for rental operators</h2>
          </div>

          <div className="grid grid-3" style={{ gap: 24 }}>
            {[
              {
                title: "Online Storefront",
                desc: "Your branded booking page on your own subdomain. Customers pick a date, choose rentals, and submit bookings 24/7.",
              },
              {
                title: "Real-Time Availability",
                desc: "Automatic conflict detection prevents double-bookings. Every confirmed order blocks inventory for that date.",
              },
              {
                title: "Delivery Route Management",
                desc: "Optimized delivery routes with stop-by-stop tracking and a mobile-friendly crew view for drivers.",
              },
              {
                title: "Invoicing & Payments",
                desc: "Automatic invoices, deposit tracking, and Stripe payment processing. Always know who owes what.",
              },
              {
                title: "Customer Portal",
                desc: "Customers can check order status, sign waivers, and message your team — all without calling you.",
              },
              {
                title: "Team Management",
                desc: "Invite crew members with role-based access. Everyone sees the schedule without accessing billing.",
              },
            ].map((feature) => (
              <div key={feature.title} className="panel" style={{ padding: 24 }}>
                <strong>{feature.title}</strong>
                <p className="muted" style={{ marginTop: 8 }}>{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section
          id="pricing"
          style={{
            padding: "60px 24px",
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="kicker">Simple pricing</div>
            <h2>Plans that grow with your business</h2>
            <p className="muted">
              Start free with up to 5 products and 10 orders/month. Upgrade when you are ready.
            </p>
          </div>

          <div className="grid grid-3" style={{ gap: 24 }}>
            {[
              {
                name: "Starter",
                price: "$49",
                period: "/month",
                features: ["25 products", "50 orders/month", "1 team member", "Online storefront"],
              },
              {
                name: "Pro",
                price: "$99",
                period: "/month",
                popular: true,
                features: [
                  "100 products",
                  "200 orders/month",
                  "5 team members",
                  "Stripe payments",
                  "AI copilot",
                ],
              },
              {
                name: "Growth",
                price: "$199",
                period: "/month",
                features: [
                  "Unlimited products",
                  "Unlimited orders",
                  "15 team members",
                  "CSV export",
                  "Priority support",
                ],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className="panel"
                style={{
                  padding: 24,
                  border: plan.popular ? "2px solid var(--primary)" : undefined,
                }}
              >
                {plan.popular && (
                  <div className="badge" style={{ marginBottom: 8 }}>
                    Most popular
                  </div>
                )}
                <h3 style={{ margin: 0 }}>{plan.name}</h3>
                <div style={{ fontSize: "2rem", fontWeight: 800, margin: "8px 0" }}>
                  {plan.price}
                  <span className="muted" style={{ fontSize: "1rem", fontWeight: 400 }}>
                    {plan.period}
                  </span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "16px 0 24px" }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ padding: "4px 0" }}>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={plan.popular ? "primary-btn" : "secondary-btn"}
                  style={{ display: "block", textAlign: "center" }}
                >
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section
          style={{
            padding: "60px 24px",
            maxWidth: 800,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div className="kicker" style={{ marginBottom: 12 }}>
            Trusted by operators
          </div>
          <h2>What rental businesses say</h2>
          <div className="panel" style={{ padding: 32, marginTop: 24 }}>
            <p style={{ fontSize: "1.1rem", fontStyle: "italic" }}>
              &ldquo;We switched to Korent and cut our booking admin time in half.
              Customers love the online booking, and I love not getting calls at 9pm
              asking if a bounce house is available.&rdquo;
            </p>
            <div className="muted" style={{ marginTop: 12 }}>
              — Rental business operator
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section
          style={{
            textAlign: "center",
            padding: "60px 24px 80px",
            maxWidth: 600,
            margin: "0 auto",
          }}
        >
          <h2>Ready to grow your rental business?</h2>
          <p className="muted" style={{ marginBottom: 24 }}>
            Free to start. No credit card required. Set up your storefront in minutes.
          </p>
          <Link href="/signup" className="primary-btn" style={{ fontSize: "1.05rem", padding: "12px 32px" }}>
            Start Free Trial
          </Link>
        </section>
      </main>

      <footer
        style={{
          textAlign: "center",
          padding: "24px",
          borderTop: "1px solid var(--border, #e5e7eb)",
          fontSize: "0.85rem",
        }}
        className="muted"
      >
        Korent — Rental business software
      </footer>
    </>
  );
}
