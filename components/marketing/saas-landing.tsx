import Link from "next/link";
import Image from "next/image";
import { MobileMenuToggle } from "@/components/layout/mobile-menu-toggle";

/**
 * SaaS marketing landing page for the root domain (korent.app without a subdomain).
 *
 * This page targets rental business OPERATORS — not end customers.
 * End customers see the operator's storefront on tenant subdomains.
 *
 * Phase 1 structure (8.5/10 target):
 *  1. Header
 *  2. Hero — single primary CTA, demo as secondary text link
 *  3. Trust bar — pre-launch signals (no credit card, cancel anytime, setup time)
 *  4. Pain section — 5 operator pain points before any feature is named
 *  5. How it works — 3-step operator flow
 *  6. Benefits section — outcome framing, not feature names
 *  7. Dashboard preview — booking calendar, pipeline, routes, checkout mockups
 *  8. ROI & positioning — time/money framing + price comparison
 *  9. Testimonials — replace placeholder quotes with real customers before launch
 * 10. Competitor comparison — vs. spreadsheets
 * 11. Pricing — free tier card, checkmarks, tier-specific CTAs, Stripe note, cancel anytime
 * 12. FAQ — 6 objection-handling questions
 * 13. Final CTA — single focus with trust signals
 * 14. Footer
 */
export function SaasLanding() {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "korent.app";
  const isLocalDev = appDomain.startsWith("localhost") || appDomain.startsWith("127.0.0.1");
  const demoUrl = isLocalDev ? "#" : `https://demo.${appDomain}`;

  return (
    <>
      {/* ── Header ─────────────────────────────────────────────── */}
      <header
        className="saas-header"
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--border, #e5e7eb)",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="Korent" style={{ height: 36, width: "auto", display: "block" }} />
        <nav className="saas-header-nav">
          <a href="#pain" className="ghost-btn">Why Korent</a>
          <a href="#features" className="ghost-btn">Features</a>
          <a href="#pricing" className="ghost-btn">Pricing</a>
          <a href="#faq" className="ghost-btn">FAQ</a>
          <Link href="/login" className="secondary-btn">Log In</Link>
          <Link href="/signup" className="primary-btn">Start Free</Link>
        </nav>
        <MobileMenuToggle
          isOperator={false}
          navLinks={[
            { key: "why_korent", label: "Why Korent", href: "#pain" },
            { key: "features", label: "Features", href: "#features" },
            { key: "pricing", label: "Pricing", href: "#pricing" },
            { key: "faq", label: "FAQ", href: "#faq" },
          ]}
          cta={{ label: "Start Free", href: "/signup" }}
          authLabel="Log In"
        />
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="saas-hero-grid">
          <div className="saas-hero-copy">
            <div className="kicker">Party &amp; event rental software</div>
            <h1>
              Stop answering availability calls. Start taking bookings online.
            </h1>
            <p className="muted">
              Korent gives your rental business an online storefront, real-time availability,
              automated reminders, and delivery routing — so you can run more events with less chaos.
            </p>

            <Link
              href="/signup"
              className="primary-btn"
              style={{ fontSize: "1.1rem", padding: "14px 36px", display: "inline-block" }}
            >
              Start Free — No Credit Card
            </Link>

            <div style={{ marginTop: 14 }}>
              <a
                href={demoUrl}
                rel="noopener noreferrer"
                style={{ color: "var(--primary, #2563eb)", fontWeight: 500, fontSize: "0.95rem" }}
              >
                or see the live demo storefront →
              </a>
            </div>
          </div>

          <div className="saas-hero-image">
            <Image
              src="/home/operator-with-ipad.jpg"
              alt="Rental operator using the Korent dashboard on a tablet next to a branded delivery trailer"
              fill
              priority
              sizes="(max-width: 860px) 100vw, 540px"
            />
          </div>
        </section>

        {/* ── Trust bar ──────────────────────────────────────────── */}
        <section
          style={{
            borderTop: "1px solid var(--border, #e5e7eb)",
            borderBottom: "1px solid var(--border, #e5e7eb)",
            padding: "16px 24px",
            background: "var(--surface-soft, #f8f9fa)",
          }}
        >
          <div
            style={{
              maxWidth: 800,
              margin: "0 auto",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "8px 32px",
              fontSize: "0.88rem",
              fontWeight: 500,
              color: "var(--text-muted, #6b7280)",
            }}
          >
            {[
              "✓ Free 14-day trial",
              "✓ No credit card required",
              "✓ Cancel anytime",
              "✓ Setup in under 30 minutes",
              "✓ Payments powered by Stripe",
            ].map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        {/* ── Pain section ───────────────────────────────────────── */}
        <section
          id="pain"
          style={{
            padding: "72px 24px",
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="kicker">Sound familiar?</div>
            <h2>Running a rental business is harder than it should be</h2>
            <p className="muted" style={{ maxWidth: 560, margin: "8px auto 0" }}>
              Most operators piece together spreadsheets, texts, and phone calls to manage bookings.
              There&rsquo;s a better way.
            </p>
          </div>

          <div className="grid grid-3 stat-grid-responsive" style={{ gap: 20 }}>
            {[
              {
                icon: "📞",
                pain: "Availability calls at 9pm",
                desc: "You're checking the calendar on your phone while watching TV, then texting back one-by-one.",
              },
              {
                icon: "😬",
                pain: "Double-bookings happen",
                desc: "Two customers show up for the same rental on the same Saturday. Someone's event gets ruined.",
              },
              {
                icon: "📋",
                pain: "Spreadsheets everywhere",
                desc: "Your booking log, deposit tracker, and customer list live in three different places — none of them talk to each other.",
              },
              {
                icon: "🗺️",
                pain: "Delivery chaos on the day",
                desc: "Drivers figuring out routes at 6am. Equipment loaded out of order. Late arrivals before the party starts.",
              },
              {
                icon: "💸",
                pain: "Chasing deposits and waivers",
                desc: "Paper contracts get lost. Deposit reminders go unanswered. You spend more time on admin than on rentals.",
              },
              {
                icon: "📵",
                pain: "No time to grow",
                desc: "You're so busy managing existing bookings you can't think about adding more inventory or new event types.",
              },
            ].map((item) => (
              <div
                key={item.pain}
                className="panel"
                style={{ padding: 24 }}
              >
                <div style={{ fontSize: "1.8rem", marginBottom: 10 }}>{item.icon}</div>
                <strong style={{ fontSize: "0.95rem" }}>{item.pain}</strong>
                <p className="muted" style={{ marginTop: 6, fontSize: "0.88rem" }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Banner: pain → solution transition ─────────────────── */}
        <div className="saas-banner">
          <div className="saas-banner-frame">
            <Image
              src="/home/event-setup.jpg"
              alt="Crew member anchoring a bounce house at a backyard event while kids wait to play"
              fill
              sizes="(max-width: 1200px) 100vw, 1140px"
            />
            <div className="saas-banner-overlay">
              <div>
                <div className="kicker">From chaos to confidence</div>
                <h2>Run real events without the Saturday-morning scramble</h2>
              </div>
            </div>
          </div>
        </div>

        {/* ── How it works ───────────────────────────────────────── */}
        <section
          style={{
            padding: "60px 24px",
            maxWidth: 1000,
            margin: "0 auto",
            background: "var(--surface-soft, #f8f9fa)",
            borderRadius: 16,
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="kicker">Get started in minutes</div>
            <h2>How it works</h2>
          </div>

          <div className="grid grid-3 stat-grid-responsive" style={{ gap: 24 }}>
            {[
              {
                step: "1",
                title: "Sign Up & Set Up",
                desc: "Create your account, add your inventory, and customize your storefront in under 30 minutes. No coding needed.",
              },
              {
                step: "2",
                title: "Share Your Link",
                desc: `Your customers visit your-business.${appDomain} to browse, check availability, and book online — 24/7.`,
              },
              {
                step: "3",
                title: "Manage & Grow",
                desc: "Track orders, plan deliveries, collect payments, and send automated reminders — all from one dashboard.",
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

        {/* ── Benefits (outcome framing) ──────────────────────────── */}
        <section
          id="features"
          style={{
            padding: "72px 24px",
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="kicker">What changes when you use Korent</div>
            <h2>Get your evenings back. Book more weekends.</h2>
          </div>

          <div className="grid grid-3 stat-grid-responsive" style={{ gap: 24 }}>
            {[
              {
                title: "Customers book themselves",
                desc: "Your branded storefront lets customers check dates, pick rentals, and pay a deposit — without calling you. Bookings come in while you sleep.",
              },
              {
                title: "Zero double-bookings, ever",
                desc: "Every confirmed order automatically blocks inventory for that date. No spreadsheet to update, no risk of double-booking the same item.",
              },
              {
                title: "Drivers know exactly where to go",
                desc: "Build delivery routes in the dashboard. Crew members get a mobile-optimized stop-by-stop view — no morning scramble, no missed deliveries.",
              },
              {
                title: "Deposits and waivers, automated",
                desc: "Customers sign rental agreements and pay deposits online. Reminders go out automatically. You stop chasing paperwork.",
              },
              {
                title: "Every customer in one place",
                desc: "Full order history, contact info, and event notes for every customer. Know who booked what, when, and whether they paid.",
              },
              {
                title: "Your team, with the right access",
                desc: "Invite crew members who see the schedule without touching billing. Give office staff order access without exposing payment data.",
              },
            ].map((benefit) => (
              <div key={benefit.title} className="panel" style={{ padding: 24 }}>
                <strong style={{ fontSize: "1rem" }}>{benefit.title}</strong>
                <p className="muted" style={{ marginTop: 8, fontSize: "0.9rem" }}>{benefit.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Feature showcase: customer + crew ──────────────────── */}
        <section style={{ padding: "60px 24px", maxWidth: 1100, margin: "0 auto" }}>
          <div className="saas-feature-row">
            <div className="saas-feature-image">
              <Image
                src="/home/customer-booking-phone.jpg"
                alt="A customer reserving a Castle Bounce House on their phone using the Korent storefront"
                fill
                sizes="(max-width: 860px) 100vw, 540px"
              />
            </div>
            <div className="saas-feature-copy">
              <div className="kicker">Customer-facing storefront</div>
              <h3>Customers book themselves — even at 11pm</h3>
              <p className="muted">
                Your branded site shows real-time availability by date and ZIP. Customers pick rentals,
                enter delivery info, and pay a deposit in about three minutes. You wake up to confirmed
                orders instead of voicemails.
              </p>
            </div>
          </div>

          <div className="saas-feature-row reverse">
            <div className="saas-feature-image">
              <Image
                src="/home/crew-loading-trailer.jpg"
                alt="Two crew members in branded shirts loading an inflatable into a delivery trailer"
                fill
                sizes="(max-width: 860px) 100vw, 540px"
              />
            </div>
            <div className="saas-feature-copy">
              <div className="kicker">Delivery &amp; routing</div>
              <h3>Drivers know exactly where to go</h3>
              <p className="muted">
                Build optimized delivery routes in the dashboard. Each crew member gets a mobile-ready
                stop list with the address, contact, gate code, and setup notes — no more 6am text
                threads asking which house is first.
              </p>
            </div>
          </div>
        </section>

        {/* ── Dashboard preview ──────────────────────────────────── */}
        <section
          style={{
            padding: "60px 24px",
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="kicker">Your command center</div>
            <h2>See what&rsquo;s inside</h2>
            <p className="muted" style={{ maxWidth: 560, margin: "8px auto 0" }}>
              Every tool you need to run your rental business, in one dashboard.
            </p>
          </div>

          <div className="saas-dashboard-hero">
            <Image
              src="/home/dashboard-tablet.jpg"
              alt="The Korent operator dashboard open on a tablet showing an order with delivery route and timeline"
              fill
              sizes="(max-width: 980px) 100vw, 940px"
            />
          </div>

          <div className="grid grid-2 two-col-responsive" style={{ gap: 24 }}>
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
                  { label: "Scheduled", count: 3, color: "var(--primary, #e8590c)" },
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
                <svg viewBox="0 0 300 120" style={{ width: "100%", height: "100%" }} aria-hidden="true">
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
              rel="noopener noreferrer"
            >
              See the Full Demo Storefront
            </a>
          </div>
        </section>

        {/* ── ROI & Positioning ──────────────────────────────────── */}
        <section
          style={{
            padding: "60px 24px",
            maxWidth: 860,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div className="kicker" style={{ marginBottom: 12 }}>The numbers</div>
          <h2 style={{ margin: "0 0 12px" }}>
            Save 10+ hours a week at $49/month
          </h2>
          <p className="muted" style={{ fontSize: "1.05rem", maxWidth: 560, margin: "0 auto 36px" }}>
            That&rsquo;s under $1.25/hour to stop answering availability calls, eliminate double-bookings,
            and let customers book themselves. Other rental software starts at $125+/month.
          </p>

          <div className="grid grid-3 stat-grid-responsive" style={{ gap: 16 }}>
            {[
              { stat: "10+ hrs", label: "Saved per week on booking admin" },
              { stat: "0", label: "Double-bookings with automatic conflict detection" },
              { stat: "$49/mo", label: "Starting price — vs. $125+ elsewhere" },
            ].map((item) => (
              <div key={item.label} className="panel" style={{ padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: "2rem", fontWeight: 800, color: "var(--primary, #2563eb)" }}>
                  {item.stat}
                </div>
                <div className="muted" style={{ marginTop: 6, fontSize: "0.85rem" }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Testimonials ───────────────────────────────────────── */}
        {/*
          REPLACE THESE WITH REAL CUSTOMER QUOTES BEFORE LAUNCH.
          Use: name, business name, city/state, and one specific metric or outcome.
          Example format: "Sarah M. — Bounce Bliss Rentals, Tampa FL"
        */}
        <section
          style={{
            padding: "60px 24px",
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div className="kicker">Early operator feedback</div>
            <h2>What rental businesses say</h2>
          </div>

          <div className="grid grid-3 stat-grid-responsive" style={{ gap: 24 }}>
            {[
              {
                quote: "We cut booking admin time in half in the first week. Customers love being able to check availability themselves instead of calling us.",
                name: "Jamie R.",
                business: "Bounce & More Rentals",
                location: "Richmond, VA",
              },
              {
                quote: "Setting up took less than an hour. My delivery crew finally has a proper route instead of texting me every morning asking where to go first.",
                name: "Marcus T.",
                business: "Party Perfect Inflatables",
                location: "Charlotte, NC",
              },
              {
                quote: "I used to get calls all evening. Now customers book online and I get a notification. I haven't had a double-booking since we switched.",
                name: "Alicia D.",
                business: "Fun Time Party Rentals",
                location: "Columbus, OH",
              },
            ].map((t) => (
              <div key={t.name} className="panel" style={{ padding: 28 }}>
                {/* Star rating */}
                <div style={{ color: "#f59e0b", marginBottom: 12, fontSize: "1rem", letterSpacing: 1 }}>
                  ★★★★★
                </div>
                <p style={{ fontStyle: "italic", fontSize: "0.95rem", margin: "0 0 16px", lineHeight: 1.6 }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ fontSize: "0.88rem" }}>
                  <strong>{t.name}</strong>
                  <div className="muted">{t.business} &mdash; {t.location}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Competitor comparison ──────────────────────────────── */}
        <section
          style={{
            padding: "60px 24px",
            maxWidth: 800,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div className="kicker">Why switch</div>
            <h2>Korent vs. what most operators use today</h2>
          </div>

          <div
            style={{
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 12,
              overflow: "hidden",
              fontSize: "0.9rem",
            }}
          >
            {/* Header row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr",
                background: "var(--surface-soft, #f8f9fa)",
                borderBottom: "1px solid var(--border, #e5e7eb)",
                fontWeight: 700,
              }}
            >
              <div style={{ padding: "12px 16px" }}></div>
              <div style={{ padding: "12px 16px", textAlign: "center", color: "var(--primary, #2563eb)" }}>
                Korent
              </div>
              <div style={{ padding: "12px 16px", textAlign: "center", color: "var(--text-muted, #6b7280)" }}>
                Spreadsheets &amp; texts
              </div>
            </div>

            {[
              { feature: "24/7 online booking", korent: "✓", other: "✗" },
              { feature: "Automatic double-booking prevention", korent: "✓", other: "✗" },
              { feature: "Customer self-service portal", korent: "✓", other: "✗" },
              { feature: "Digital waivers & contracts", korent: "✓", other: "✗" },
              { feature: "Delivery route planning", korent: "✓", other: "✗" },
              { feature: "Automated reminders", korent: "✓", other: "✗" },
              { feature: "Stripe payment processing", korent: "✓", other: "✗" },
              { feature: "Takes your evenings back", korent: "✓", other: "✗" },
            ].map((row, i) => (
              <div
                key={row.feature}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1fr",
                  borderBottom: i < 7 ? "1px solid var(--border, #e5e7eb)" : undefined,
                  background: i % 2 === 0 ? "#fff" : "var(--surface-soft, #f8f9fa)",
                }}
              >
                <div style={{ padding: "10px 16px" }}>{row.feature}</div>
                <div style={{ padding: "10px 16px", textAlign: "center", color: "#059669", fontWeight: 700 }}>
                  {row.korent}
                </div>
                <div style={{ padding: "10px 16px", textAlign: "center", color: "#dc2626", fontWeight: 700 }}>
                  {row.other}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────────────────── */}
        <section
          id="pricing"
          style={{
            padding: "72px 24px",
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div className="kicker">Simple pricing</div>
            <h2>Start free. Pay only when you&rsquo;re ready.</h2>
            <p className="muted" style={{ maxWidth: 500, margin: "8px auto 0" }}>
              No contracts. No setup fees. Cancel anytime. Upgrade or downgrade as your business grows.
            </p>
          </div>

          {/* 4 tiers: Free + 3 paid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 20,
            }}
          >
            {[
              {
                name: "Free",
                price: "$0",
                period: "/month",
                cta: "Start Free",
                ctaStyle: "secondary-btn",
                features: [
                  "5 products",
                  "10 orders/month",
                  "1 team member",
                  "Online storefront",
                  "Email support",
                ],
              },
              {
                name: "Starter",
                price: "$49",
                period: "/month",
                cta: "Start Starter Trial",
                ctaStyle: "secondary-btn",
                features: [
                  "25 products",
                  "50 orders/month",
                  "1 team member",
                  "Online storefront",
                  "Delivery routing",
                  "Email support",
                ],
              },
              {
                name: "Pro",
                price: "$99",
                period: "/month",
                popular: true,
                cta: "Start Pro Trial",
                ctaStyle: "primary-btn",
                features: [
                  "100 products",
                  "200 orders/month",
                  "5 team members",
                  "Stripe payments",
                  "Digital waivers",
                  "AI copilot",
                  "Priority email support",
                ],
              },
              {
                name: "Growth",
                price: "$199",
                period: "/month",
                cta: "Start Growth Trial",
                ctaStyle: "secondary-btn",
                features: [
                  "Unlimited products",
                  "Unlimited orders",
                  "15 team members",
                  "CSV export",
                  "Custom domain",
                  "Priority support",
                  "Dedicated onboarding",
                ],
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className="panel"
                style={{
                  padding: 24,
                  border: plan.popular ? "2px solid var(--primary)" : undefined,
                  position: "relative",
                }}
              >
                {plan.popular && (
                  <div
                    className="badge"
                    style={{
                      position: "absolute",
                      top: -12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Most popular
                  </div>
                )}
                <h3 style={{ margin: "0 0 4px" }}>{plan.name}</h3>
                <div style={{ fontSize: "2.2rem", fontWeight: 800, margin: "8px 0 0" }}>
                  {plan.price}
                  <span className="muted" style={{ fontSize: "1rem", fontWeight: 400 }}>
                    {plan.period}
                  </span>
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: "20px 0 24px" }}>
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      style={{
                        padding: "5px 0",
                        fontSize: "0.88rem",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span style={{ color: "#059669", fontWeight: 700, flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={plan.ctaStyle}
                  style={{ display: "block", textAlign: "center" }}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>

          {/* Trust signals below pricing */}
          <div
            style={{
              textAlign: "center",
              marginTop: 32,
              fontSize: "0.88rem",
              color: "var(--text-muted, #6b7280)",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: "8px 24px",
            }}
          >
            <span>No contracts</span>
            <span>·</span>
            <span>Cancel anytime</span>
            <span>·</span>
            <span>14-day free trial on all paid plans</span>
            <span>·</span>
            <span>Payments secured by Stripe</span>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section
          id="faq"
          style={{
            padding: "60px 24px",
            maxWidth: 720,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="kicker">Common questions</div>
            <h2>FAQ</h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              {
                q: "Do I need technical skills to set up my storefront?",
                a: "No. Korent is built for operators, not developers. You add your inventory, upload photos, set your pricing, and your storefront goes live in under 30 minutes. No coding, no hosting, no domain purchase required.",
              },
              {
                q: "Can I migrate from my current spreadsheet or system?",
                a: "Yes. You can import your product catalog and customer list via CSV on all paid plans. Our onboarding guide walks you through the process step by step, and Growth plan customers get a dedicated onboarding call.",
              },
              {
                q: "What happens to my data if I cancel?",
                a: "Your data is yours. You can export all orders, customers, and inventory to CSV before you leave. We don't delete your data immediately — you'll have a 30-day window to export everything after cancellation.",
              },
              {
                q: "Will my customers find it confusing to book online?",
                a: "Korent's customer-facing storefront is designed to be as simple as booking a hotel room. Customers pick a date, choose a rental, enter their delivery address, and pay a deposit — it takes about 3 minutes. You can see exactly what they see at the live demo storefront.",
              },
              {
                q: "Does Korent handle sales tax?",
                a: "You set your own tax rate in the dashboard. Tax is calculated automatically on each order and shown on the invoice. We don't file taxes on your behalf — consult your accountant for local sales tax obligations.",
              },
              {
                q: "What if I need to cancel or refund a booking?",
                a: "You can cancel any order from the dashboard and issue a full or partial refund to the customer's card directly. Stripe processes refunds in 5-10 business days. You control the refund amount — Korent doesn't charge a fee on refunds.",
              },
            ].map((item) => (
              <details
                key={item.q}
                style={{
                  border: "1px solid var(--border, #e5e7eb)",
                  borderRadius: 10,
                  padding: "16px 20px",
                  background: "#fff",
                }}
              >
                <summary
                  style={{
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.95rem",
                    listStyle: "none",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  {item.q}
                  <span style={{ fontSize: "1.2rem", flexShrink: 0, color: "var(--text-muted, #6b7280)" }}>+</span>
                </summary>
                <p className="muted" style={{ margin: "12px 0 0", fontSize: "0.9rem", lineHeight: 1.7 }}>
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Banner: inventory readiness ────────────────────────── */}
        <div className="saas-banner">
          <div className="saas-banner-frame">
            <Image
              src="/home/inventory-warehouse.jpg"
              alt="A well-organized rental warehouse with neatly stacked inflatables, blowers, and equipment"
              fill
              sizes="(max-width: 1200px) 100vw, 1140px"
            />
            <div className="saas-banner-overlay">
              <div>
                <div className="kicker">Built for real operations</div>
                <h2>From your first bounce house to your hundredth booking</h2>
              </div>
            </div>
          </div>
        </div>

        {/* ── Final CTA ──────────────────────────────────────────── */}
        <section
          style={{
            textAlign: "center",
            padding: "72px 24px 88px",
            maxWidth: 600,
            margin: "0 auto",
          }}
        >
          <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", margin: "0 0 16px" }}>
            Ready to get your evenings back?
          </h2>
          <p className="muted" style={{ fontSize: "1.05rem", marginBottom: 32 }}>
            Free to start. No credit card. Your storefront live in under 30 minutes.
          </p>

          <Link
            href="/signup"
            className="primary-btn"
            style={{ fontSize: "1.1rem", padding: "14px 40px", display: "inline-block" }}
          >
            Start Free — No Credit Card
          </Link>

          <div style={{ marginTop: 14 }}>
            <a
              href={demoUrl}
              rel="noopener noreferrer"
              style={{ color: "var(--primary, #2563eb)", fontWeight: 500, fontSize: "0.95rem" }}
            >
              or see the live demo storefront →
            </a>
          </div>

          <p
            className="muted"
            style={{ marginTop: 20, fontSize: "0.82rem" }}
          >
            No contracts &nbsp;·&nbsp; Cancel anytime &nbsp;·&nbsp; 14-day trial on all paid plans
          </p>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer
        style={{
          textAlign: "center",
          padding: "24px",
          borderTop: "1px solid var(--border, #e5e7eb)",
          fontSize: "0.85rem",
        }}
        className="muted"
      >
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap", marginBottom: 8 }}>
          <a href="#features" style={{ color: "inherit" }}>Features</a>
          <a href="#pricing" style={{ color: "inherit" }}>Pricing</a>
          <a href="#faq" style={{ color: "inherit" }}>FAQ</a>
          <Link href="/login" style={{ color: "inherit" }}>Log In</Link>
          <Link href="/signup" style={{ color: "inherit" }}>Sign Up</Link>
          <a href="mailto:support@korent.app" style={{ color: "inherit" }}>Contact</a>
        </div>
        Korent — Rental business software
      </footer>
    </>
  );
}
