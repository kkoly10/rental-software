import Link from "next/link";
import Image from "next/image";
import { MobileMenuToggle } from "@/components/layout/mobile-menu-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getTranslator } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";

/**
 * SaaS marketing landing page for the root domain (korent.app without a subdomain).
 *
 * This page targets rental business OPERATORS — not end customers.
 * End customers see the operator's storefront on tenant subdomains.
 */
export async function SaasLanding() {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "korent.app";
  const isLocalDev = appDomain.startsWith("localhost") || appDomain.startsWith("127.0.0.1");
  const demoUrl = isLocalDev ? "#" : `https://demo.${appDomain}`;
  const { locale, messages: m } = await getTranslator();
  const s = m.saasLanding;

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
          <a href="#pain" className="ghost-btn">{s.nav.whyKorent}</a>
          <a href="#features" className="ghost-btn">{s.nav.features}</a>
          <a href="#pricing" className="ghost-btn">{s.nav.pricing}</a>
          <a href="#faq" className="ghost-btn">{s.nav.faq}</a>
          <LanguageSwitcher currentLocale={locale} ariaLabel={m.language.label} />
          <Link href="/login" className="secondary-btn">{s.nav.logIn}</Link>
          <Link href="/signup" className="primary-btn">{s.nav.startFree}</Link>
        </nav>
        <div className="mobile-header-controls">
          <LanguageSwitcher currentLocale={locale} ariaLabel={m.language.label} compact />
          <MobileMenuToggle
            isOperator={false}
            navLinks={[
              { key: "why_korent", label: s.nav.whyKorent, href: "#pain" },
              { key: "features", label: s.nav.features, href: "#features" },
              { key: "pricing", label: s.nav.pricing, href: "#pricing" },
              { key: "faq", label: s.nav.faq, href: "#faq" },
            ]}
            cta={{ label: s.nav.startFree, href: "/signup" }}
            authLabel={s.nav.logIn}
            currentLocale={locale}
            languageLabel={m.language.label}
          />
        </div>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="saas-hero-grid">
          <div className="saas-hero-copy">
            <div className="kicker">{s.hero.kicker}</div>
            <h1>{s.hero.headline}</h1>
            <p className="muted">{s.hero.subhead}</p>

            <Link
              href="/signup"
              className="primary-btn"
              style={{ fontSize: "1.1rem", padding: "14px 36px", display: "inline-block" }}
            >
              {s.hero.ctaPrimary}
            </Link>

            <div style={{ marginTop: 14 }}>
              <a
                href={demoUrl}
                rel="noopener noreferrer"
                style={{ color: "var(--primary, #2563eb)", fontWeight: 500, fontSize: "0.95rem" }}
              >
                {s.hero.demoLink}
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
            {s.trustBar.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        {/* ── Industries strip (noob recognition) ────────────────── */}
        <section
          style={{
            padding: "44px 24px 24px",
            maxWidth: 1100,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div className="kicker">{s.industries.kicker}</div>
          <h3
            style={{
              margin: "8px 0 20px",
              fontSize: "1.1rem",
              color: "var(--text-muted, #6b7280)",
              fontWeight: 600,
            }}
          >
            {s.industries.title}
          </h3>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 8,
              marginBottom: 18,
            }}
          >
            {s.industries.items.map((item) => (
              <span
                key={item}
                style={{
                  padding: "6px 14px",
                  borderRadius: 999,
                  border: "1px solid var(--border, #e5e7eb)",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  background: "#fff",
                  color: "var(--text, #111827)",
                }}
              >
                {item}
              </span>
            ))}
          </div>
          <p className="muted" style={{ fontSize: "0.92rem", margin: 0 }}>
            {s.industries.footer}
          </p>
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
            <div className="kicker">{s.pain.kicker}</div>
            <h2>{s.pain.title}</h2>
            <p className="muted" style={{ maxWidth: 560, margin: "8px auto 0" }}>
              {s.pain.subtitle}
            </p>
          </div>

          <div className="grid grid-3 stat-grid-responsive" style={{ gap: 20 }}>
            {s.pain.items.map((item, i) => {
              const icon = ["📞", "😬", "📋", "🗺️", "💸", "📵"][i] ?? "•";
              return (
                <div key={item.title} className="panel" style={{ padding: 24 }}>
                  <div style={{ fontSize: "1.8rem", marginBottom: 10 }}>{icon}</div>
                  <strong style={{ fontSize: "0.95rem" }}>{item.title}</strong>
                  <p className="muted" style={{ marginTop: 6, fontSize: "0.88rem" }}>
                    {item.body}
                  </p>
                </div>
              );
            })}
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
                <div className="kicker">{s.transitionBanner.kicker}</div>
                <h2>{s.transitionBanner.title}</h2>
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
            <div className="kicker">{s.howItWorks.kicker}</div>
            <h2>{s.howItWorks.title}</h2>
          </div>

          <div className="grid grid-3 stat-grid-responsive" style={{ gap: 24 }}>
            {s.howItWorks.steps.map((step, idx) => (
              <div key={step.title} className="panel" style={{ padding: 24, textAlign: "center" }}>
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
                  {idx + 1}
                </div>
                <h3 style={{ margin: "0 0 8px" }}>{step.title}</h3>
                <p className="muted">{formatMessage(step.body, { domain: appDomain })}</p>
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
            <div className="kicker">{s.benefits.kicker}</div>
            <h2>{s.benefits.title}</h2>
          </div>

          <div className="grid grid-3 stat-grid-responsive" style={{ gap: 24 }}>
            {s.benefits.items.map((benefit) => (
              <div key={benefit.title} className="panel" style={{ padding: 24 }}>
                <strong style={{ fontSize: "1rem" }}>{benefit.title}</strong>
                <p className="muted" style={{ marginTop: 8, fontSize: "0.9rem" }}>{benefit.body}</p>
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
              <div className="kicker">{s.featureCustomer.kicker}</div>
              <h3>{s.featureCustomer.title}</h3>
              <p className="muted">{s.featureCustomer.body}</p>
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
              <div className="kicker">{s.featureDelivery.kicker}</div>
              <h3>{s.featureDelivery.title}</h3>
              <p className="muted">{s.featureDelivery.body}</p>
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
            <div className="kicker">{s.dashboardPreview.kicker}</div>
            <h2>{s.dashboardPreview.title}</h2>
            <p className="muted" style={{ maxWidth: 560, margin: "8px auto 0" }}>
              {s.dashboardPreview.subtitle}
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
              <div className="kicker" style={{ marginBottom: 8 }}>{s.dashboardPreview.bookingCalendar}</div>
              <div
                className="saas-cal"
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
                {s.dashboardPreview.bookingCalendarBody}
              </p>
            </div>

            {/* Order Pipeline */}
            <div className="panel" style={{ padding: 24 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>{s.dashboardPreview.orderPipeline}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                {[
                  { label: s.dashboardPreview.pipelineStages.confirmed, count: 5, color: "#059669" },
                  { label: s.dashboardPreview.pipelineStages.scheduled, count: 3, color: "var(--primary, #e8590c)" },
                  { label: s.dashboardPreview.pipelineStages.outForDelivery, count: 2, color: "#d97706" },
                  { label: s.dashboardPreview.pipelineStages.delivered, count: 1, color: "#7c3aed" },
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
                {s.dashboardPreview.orderPipelineBody}
              </p>
            </div>

            {/* Delivery Map */}
            <div className="panel" style={{ padding: 24 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>{s.dashboardPreview.deliveryRoutes}</div>
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
                {s.dashboardPreview.deliveryRoutesBody}
              </p>
            </div>

            {/* Online Checkout */}
            <div className="panel" style={{ padding: 24 }}>
              <div className="kicker" style={{ marginBottom: 8 }}>{s.dashboardPreview.onlineCheckout}</div>
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
                    <strong style={{ fontSize: "0.92rem" }}>{s.dashboardPreview.sampleProduct}</strong>
                    <div className="muted" style={{ fontSize: "0.8rem", marginTop: 2 }}>
                      {s.dashboardPreview.sampleDate}
                    </div>
                  </div>
                  <strong style={{ fontSize: "1.1rem" }}>$175</strong>
                </div>
                <div style={{ borderTop: "1px solid var(--border, #e5e7eb)", margin: "12px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span className="muted">{s.dashboardPreview.deliveryFee}</span>
                  <span>$35</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginTop: 4 }}>
                  <span className="muted">{s.dashboardPreview.depositPercent}</span>
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
                  {s.dashboardPreview.reserveNow}
                </div>
              </div>
              <p className="muted" style={{ fontSize: "0.88rem", margin: 0 }}>
                {s.dashboardPreview.onlineCheckoutBody}
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
              {s.dashboardPreview.seeDemo}
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
          <div className="kicker" style={{ marginBottom: 12 }}>{s.roi.kicker}</div>
          <h2 style={{ margin: "0 0 12px" }}>{s.roi.title}</h2>
          <p className="muted" style={{ fontSize: "1.05rem", maxWidth: 560, margin: "0 auto 36px" }}>
            {s.roi.body}
          </p>

          <div className="grid grid-3 stat-grid-responsive" style={{ gap: 16 }}>
            {s.roi.stats.map((item) => (
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
        <section
          style={{
            padding: "60px 24px",
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div className="kicker">{s.testimonials.kicker}</div>
            <h2>{s.testimonials.title}</h2>
          </div>

          <div className="grid grid-3 stat-grid-responsive" style={{ gap: 24 }}>
            {s.testimonials.items.map((t) => (
              <div key={t.name} className="panel" style={{ padding: 28 }}>
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
            <div className="kicker">{s.comparison.kicker}</div>
            <h2>{s.comparison.title}</h2>
          </div>

          <div
            className="saas-compare"
            role="table"
            aria-label={s.comparison.title}
            style={{
              border: "1px solid var(--border, #e5e7eb)",
              borderRadius: 12,
              overflow: "hidden",
              fontSize: "0.9rem",
            }}
          >
            <div
              className="saas-compare-header"
              role="row"
              style={{
                background: "var(--surface-soft, #f8f9fa)",
                borderBottom: "1px solid var(--border, #e5e7eb)",
                fontWeight: 700,
              }}
            >
              <div role="columnheader" />
              <div role="columnheader" style={{ color: "var(--primary, #2563eb)" }}>
                {s.comparison.korentColumn}
              </div>
              <div role="columnheader" style={{ color: "var(--text-muted, #6b7280)" }}>
                {s.comparison.otherColumn}
              </div>
            </div>

            {s.comparison.rows.map((feature, i) => (
              <div
                key={feature}
                className="saas-compare-row"
                role="row"
                style={{
                  borderBottom: i < s.comparison.rows.length - 1 ? "1px solid var(--border, #e5e7eb)" : undefined,
                  background: i % 2 === 0 ? "#fff" : "var(--surface-soft, #f8f9fa)",
                }}
              >
                <div role="cell" className="saas-compare-feature">{feature}</div>
                <div role="cell" className="saas-compare-cell saas-compare-cell-korent">
                  <span className="saas-compare-mobile-label" aria-hidden="true">{s.comparison.korentColumn}</span>
                  <span style={{ color: "#059669", fontWeight: 700 }} aria-label={`${s.comparison.korentColumn}: yes`}>✓</span>
                </div>
                <div role="cell" className="saas-compare-cell saas-compare-cell-other">
                  <span className="saas-compare-mobile-label" aria-hidden="true">{s.comparison.otherColumn}</span>
                  <span style={{ color: "#dc2626", fontWeight: 700 }} aria-label={`${s.comparison.otherColumn}: no`}>✗</span>
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
            <div className="kicker">{s.pricingSection.kicker}</div>
            <h2>{s.pricingSection.title}</h2>
            <p className="muted" style={{ maxWidth: 500, margin: "8px auto 0" }}>
              {s.pricingSection.subtitle}
            </p>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 20,
            }}
          >
            {s.pricingSection.plans.map((plan, idx) => {
              const popular = idx === 2; // Pro plan
              const ctaStyle = popular ? "primary-btn" : "secondary-btn";
              return (
                <div
                  key={plan.name}
                  className="panel"
                  style={{
                    padding: 24,
                    border: popular ? "2px solid var(--primary)" : undefined,
                    position: "relative",
                  }}
                >
                  {popular && (
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
                      {s.pricingSection.mostPopular}
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
                    className={ctaStyle}
                    style={{ display: "block", textAlign: "center" }}
                  >
                    {plan.cta}
                  </Link>
                </div>
              );
            })}
          </div>

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
            {s.pricingSection.trustSignals.flatMap((signal, i) => {
              const items = [<span key={signal}>{signal}</span>];
              if (i < s.pricingSection.trustSignals.length - 1) {
                items.push(<span key={`sep-${i}`} aria-hidden="true">·</span>);
              }
              return items;
            })}
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
            <div className="kicker">{s.faq.kicker}</div>
            <h2>{s.faq.title}</h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {s.faq.items.map((item) => (
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
                <div className="kicker">{s.inventoryBanner.kicker}</div>
                <h2>{s.inventoryBanner.title}</h2>
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
            {s.finalCta.title}
          </h2>
          <p className="muted" style={{ fontSize: "1.05rem", marginBottom: 32 }}>
            {s.finalCta.subtitle}
          </p>

          <Link
            href="/signup"
            className="primary-btn"
            style={{ fontSize: "1.1rem", padding: "14px 40px", display: "inline-block" }}
          >
            {s.finalCta.ctaPrimary}
          </Link>

          <div style={{ marginTop: 14 }}>
            <a
              href={demoUrl}
              rel="noopener noreferrer"
              style={{ color: "var(--primary, #2563eb)", fontWeight: 500, fontSize: "0.95rem" }}
            >
              {s.finalCta.demoLink}
            </a>
          </div>

          <p
            className="muted"
            style={{ marginTop: 20, fontSize: "0.82rem" }}
          >
            {s.finalCta.trustLine}
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
          <a href="#features" style={{ color: "inherit" }}>{s.nav.features}</a>
          <a href="#pricing" style={{ color: "inherit" }}>{s.nav.pricing}</a>
          <a href="#faq" style={{ color: "inherit" }}>{s.nav.faq}</a>
          <Link href="/login" style={{ color: "inherit" }}>{s.nav.logIn}</Link>
          <Link href="/signup" style={{ color: "inherit" }}>{m.common.signUp}</Link>
          <a href="mailto:support@korent.app" style={{ color: "inherit" }}>{s.nav.contact}</a>
        </div>
        {s.footer.tagline}
      </footer>
    </>
  );
}
