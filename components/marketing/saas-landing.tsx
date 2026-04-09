import Link from "next/link";

/**
 * SaaS marketing landing page for the root domain (korent.app without a subdomain).
 *
 * This page targets rental business OPERATORS — not end customers.
 * End customers see the operator's storefront on tenant subdomains.
 */
export function SaasLanding() {
  const demoUrl = `https://demo.${process.env.NEXT_PUBLIC_APP_DOMAIN || "korent.app"}`;

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
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" className="primary-btn" style={{ fontSize: "1.05rem", padding: "12px 28px" }}>
              Start Free Trial
            </Link>
            <a href={demoUrl} className="secondary-btn" style={{ fontSize: "1.05rem", padding: "12px 28px" }}>
              See a Live Demo
            </a>
          </div>
        </section>

        {/* How it works — operator-focused 3-step */}
        <section
          style={{
            padding: "60px 24px",
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="kicker">Get started in minutes</div>
            <h2>How it works</h2>
          </div>

          <div className="grid grid-3" style={{ gap: 24 }}>
            {[
              {
                step: "1",
                title: "Sign Up & Set Up",
                desc: "Create your account, add your inventory, and customize your storefront in under 30 minutes. No coding needed.",
              },
              {
                step: "2",
                title: "Share Your Link",
                desc: "Your customers visit your-business.korent.app to browse, check availability, and book online.",
              },
              {
                step: "3",
                title: "Manage & Grow",
                desc: "Track orders, plan deliveries, collect payments, and send automated reminders — all from your dashboard.",
              },
            ].map((item) => (
              <div key={item.step} className="panel" style={{ padding: 24, textAlign: "center" }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: "var(--primary, #2563eb)",
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 800,
                    fontSize: "1.1rem",
                    marginBottom: 12,
                  }}
                >
                  {item.step}
                </div>
                <h3 style={{ margin: "0 0 8px" }}>{item.title}</h3>
                <p className="muted">{item.desc}</p>
              </div>
            ))}
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
                desc: "Plan and track delivery routes with stop-by-stop visibility and a mobile-friendly crew view for drivers.",
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

        {/* Dashboard preview — "Your command center" */}
        <section
          style={{
            padding: "60px 24px",
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="kicker">Your command center</div>
            <h2>See what you get</h2>
            <p className="muted" style={{ maxWidth: 600, margin: "8px auto 0" }}>
              Every tool you need to run your rental business, in one dashboard.
            </p>
          </div>

          <div className="grid grid-2" style={{ gap: 24 }}>
            {/* Booking Calendar */}
            <div className="panel" style={{ padding: 24 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Booking Calendar</div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: 4,
                  marginBottom: 12,
                }}
              >
                {["M", "T", "W", "T", "F", "S", "S"].map((day, i) => (
                  <div
                    key={`h-${i}`}
                    style={{
                      textAlign: "center",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--text-muted, #6b7280)",
                      padding: "4px 0",
                    }}
                  >
                    {day}
                  </div>
                ))}
                {Array.from({ length: 28 }, (_, i) => {
                  const hasEvent = [3, 7, 8, 14, 15, 21, 24].includes(i);
                  return (
                    <div
                      key={i}
                      style={{
                        textAlign: "center",
                        padding: "6px 2px",
                        borderRadius: 4,
                        fontSize: "0.8rem",
                        background: hasEvent ? "var(--primary, #2563eb)" : undefined,
                        color: hasEvent ? "#fff" : undefined,
                        fontWeight: hasEvent ? 600 : 400,
                      }}
                    >
                      {i + 1}
                    </div>
                  );
                })}
              </div>
              <p className="muted" style={{ fontSize: "0.88rem", margin: 0 }}>
                See every event at a glance
              </p>
            </div>

            {/* Order Pipeline */}
            <div className="panel" style={{ padding: 24 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Order Pipeline</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {[
                  { label: "Confirmed", count: 5, color: "#059669" },
                  { label: "Scheduled", count: 3, color: "#2563eb" },
                  { label: "Out for Delivery", count: 2, color: "#d97706" },
                  { label: "Delivered", count: 1, color: "#7c3aed" },
                ].map((stage) => (
                  <div
                    key={stage.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--border, #e5e7eb)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: stage.color,
                        }}
                      />
                      <span style={{ fontSize: "0.88rem" }}>{stage.label}</span>
                    </div>
                    <strong style={{ fontSize: "0.88rem" }}>{stage.count}</strong>
                  </div>
                ))}
              </div>
              <p className="muted" style={{ fontSize: "0.88rem", margin: 0 }}>
                Track orders from inquiry to delivery
              </p>
            </div>

            {/* Delivery Map */}
            <div className="panel" style={{ padding: 24 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Delivery Routes</div>
              <div
                style={{
                  position: "relative",
                  background: "var(--surface-soft, #f8f9fa)",
                  borderRadius: 8,
                  height: 140,
                  marginBottom: 12,
                  overflow: "hidden",
                }}
              >
                {/* Simulated route path */}
                <svg viewBox="0 0 300 120" style={{ width: "100%", height: "100%" }}>
                  <path
                    d="M30,90 Q80,20 150,60 T270,30"
                    fill="none"
                    stroke="var(--primary, #2563eb)"
                    strokeWidth="2.5"
                    strokeDasharray="6,4"
                    opacity="0.7"
                  />
                  {[
                    { x: 30, y: 90, n: "1" },
                    { x: 110, y: 40, n: "2" },
                    { x: 190, y: 55, n: "3" },
                    { x: 270, y: 30, n: "4" },
                  ].map((stop) => (
                    <g key={stop.n}>
                      <circle cx={stop.x} cy={stop.y} r="12" fill="var(--primary, #2563eb)" />
                      <text
                        x={stop.x}
                        y={stop.y + 4}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize="11"
                        fontWeight="bold"
                      >
                        {stop.n}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
              <p className="muted" style={{ fontSize: "0.88rem", margin: 0 }}>
                Plan delivery routes visually
              </p>
            </div>

            {/* Online Checkout */}
            <div className="panel" style={{ padding: 24 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>Online Checkout</div>
              <div
                style={{
                  border: "1px solid var(--border, #e5e7eb)",
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: "0.92rem" }}>Rainbow Castle Bounce House</strong>
                    <div className="muted" style={{ fontSize: "0.8rem", marginTop: 2 }}>
                      Sat, Jun 14 &middot; 22554
                    </div>
                  </div>
                  <strong style={{ fontSize: "1.1rem" }}>$175</strong>
                </div>
                <div style={{ borderTop: "1px solid var(--border, #e5e7eb)", margin: "12px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span className="muted">Delivery fee</span>
                  <span>$35</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginTop: 4 }}>
                  <span className="muted">Deposit (25%)</span>
                  <strong>$52.50</strong>
                </div>
                <div
                  style={{
                    marginTop: 12,
                    padding: "8px 0",
                    background: "var(--primary, #2563eb)",
                    color: "#fff",
                    textAlign: "center",
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: "0.88rem",
                  }}
                >
                  Reserve Now
                </div>
              </div>
              <p className="muted" style={{ fontSize: "0.88rem", margin: 0 }}>
                Let customers book while you sleep
              </p>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 32 }}>
            <a
              href={demoUrl}
              className="secondary-btn"
              style={{ fontSize: "1rem", padding: "10px 24px" }}
            >
              See a Live Demo Storefront
            </a>
          </div>
        </section>

        {/* Social proof / positioning */}
        <section
          style={{
            padding: "60px 24px",
            maxWidth: 800,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div className="kicker" style={{ marginBottom: 12 }}>
            Built for operators like you
          </div>
          <h2 style={{ margin: "0 0 16px" }}>
            One platform, everything you need
          </h2>
          <p
            className="muted"
            style={{ fontSize: "1.05rem", maxWidth: 600, margin: "0 auto 32px" }}
          >
            Orders, payments, delivery routes, documents, weather alerts, and
            more — in one place. Other software charges $125+/month. Korent
            starts at $49/month.
          </p>

          <div className="grid grid-3" style={{ gap: 16 }}>
            {[
              { stat: "24/7", label: "Online booking" },
              { stat: "Built-in", label: "Conflict prevention" },
              { stat: "<30 min", label: "Setup time" },
            ].map((item) => (
              <div key={item.label} className="panel" style={{ padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--primary, #2563eb)" }}>
                  {item.stat}
                </div>
                <div className="muted" style={{ marginTop: 4, fontSize: "0.88rem" }}>
                  {item.label}
                </div>
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
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" className="primary-btn" style={{ fontSize: "1.05rem", padding: "12px 32px" }}>
              Start Free Trial
            </Link>
            <a href={demoUrl} className="secondary-btn" style={{ fontSize: "1.05rem", padding: "12px 32px" }}>
              See a Live Demo
            </a>
          </div>
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
