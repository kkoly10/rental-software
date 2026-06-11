import Link from "next/link";
import Image from "next/image";
import { MobileMenuToggle } from "@/components/layout/mobile-menu-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getTranslator } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";
import { listVerticals } from "@/lib/verticals/registry";

/**
 * SaaS marketing landing page for the root domain (korent.app without a
 * subdomain). Targets rental business OPERATORS — not end customers.
 *
 * Styling lives in app/marketing.css (mk-* classes): the storefront's
 * editorial language (Fraunces display, Inter Tight body, warm paper
 * neutrals, hairlines) with Korent's own accent. No testimonials section:
 * we have no named operators to quote and will not fabricate social proof
 * — same policy as VerticalLanding.
 */

/** Split a headline at the first sentence boundary so the second
 *  sentence renders as the editorial italic accent. Falls back to the
 *  whole string when a locale's headline is a single sentence. */
function splitHeadline(headline: string): { lead: string; accent: string | null } {
  const idx = headline.indexOf(". ");
  if (idx === -1) return { lead: headline, accent: null };
  return { lead: headline.slice(0, idx + 1), accent: headline.slice(idx + 2) };
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 7.5L5.5 10.5L11.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export async function SaasLanding() {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "korent.app";
  const isLocalDev = appDomain.startsWith("localhost") || appDomain.startsWith("127.0.0.1");
  const demoUrl = isLocalDev ? "#" : `https://demo.${appDomain}`;
  const { locale, messages: m } = await getTranslator();
  const s = m.saasLanding;
  const headline = splitHeadline(s.hero.headline);
  const verticals = listVerticals();

  return (
    <div className="mk-page">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="mk-header">
        <div className="mk-header-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Korent" style={{ height: 34, width: "auto", display: "block" }} />
          <nav className="saas-header-nav">
            <a href="#pain" className="mk-nav-link">{s.nav.whyKorent}</a>
            <a href="#features" className="mk-nav-link">{s.nav.features}</a>
            <a href="#pricing" className="mk-nav-link">{s.nav.pricing}</a>
            <a href="#faq" className="mk-nav-link">{s.nav.faq}</a>
            <LanguageSwitcher currentLocale={locale} ariaLabel={m.language.label} />
            <Link href="/login" className="mk-btn mk-btn--outline">{s.nav.logIn}</Link>
            <Link href="/signup" className="mk-btn mk-btn--accent">{s.nav.startFree}</Link>
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
        </div>
      </header>

      <main>
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="mk-hero">
          <div className="mk-hero-copy">
            <span className="mk-eyebrow">{s.hero.kicker}</span>
            <h1>
              {headline.lead}
              {headline.accent && (
                <>
                  {" "}
                  <em>{headline.accent}</em>
                </>
              )}
            </h1>
            <p className="mk-lede">{s.hero.subhead}</p>
            <div className="mk-hero-actions">
              <Link href="/signup" className="mk-btn mk-btn--accent mk-btn--lg">
                {s.hero.ctaPrimary}
              </Link>
              <a href={demoUrl} rel="noopener noreferrer" className="mk-text-link">
                {s.hero.demoLink}
              </a>
            </div>
          </div>
          <div className="mk-hero-image">
            <Image
              src="/home/operator-with-ipad.jpg"
              alt="Rental operator using the Korent dashboard on a tablet next to a branded delivery trailer"
              fill
              priority
              sizes="(max-width: 860px) 100vw, 520px"
            />
          </div>
        </section>

        {/* ── Trust strip ────────────────────────────────────────── */}
        <section className="mk-trust-strip">
          <div className="mk-trust-strip-inner">
            {s.trustBar.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        {/* ── Vertical selector — routes searchers to the page built
             for their business AND feeds internal link equity to the
             six "<vertical> rental software" SEO pages. Tiles use each
             vertical's scenic marketing photo. ────────────────────── */}
        <section className="mk-section--tight" style={{ paddingTop: 64 }}>
          <div className="mk-container">
            <div className="mk-section-head">
              <span className="mk-eyebrow">{s.industries.kicker}</span>
              <h2>{s.industries.title}</h2>
            </div>
            <div className="mk-tile-grid">
              {verticals.map((vertical) => {
                const tileImage =
                  vertical.imageSlugs.transitionBanner ?? vertical.imageSlugs.hero;
                return (
                  <Link
                    key={vertical.slug}
                    href={`/${vertical.marketing.landingPageSlug}`}
                    className="mk-tile"
                  >
                    <span className="mk-tile-image">
                      <Image
                        src={tileImage}
                        alt={`${vertical.label.en} rentals`}
                        fill
                        sizes="(max-width: 600px) 100vw, (max-width: 960px) 50vw, 370px"
                      />
                    </span>
                    <span className="mk-tile-body">
                      <strong>{vertical.label.en}</strong>
                      <span>{vertical.marketing.heroKicker} →</span>
                    </span>
                  </Link>
                );
              })}
            </div>
            <p className="mk-muted mk-small" style={{ textAlign: "center", margin: "22px 0 0" }}>
              {s.industries.footer}
            </p>
          </div>
        </section>

        {/* ── Pain — editorial numbered list, no icon clip art ────── */}
        <section id="pain" className="mk-section">
          <div className="mk-container">
            <div className="mk-section-head">
              <span className="mk-eyebrow">{s.pain.kicker}</span>
              <h2>{s.pain.title}</h2>
              <p className="mk-muted">{s.pain.subtitle}</p>
            </div>
            <div className="mk-numbered-grid">
              {s.pain.items.map((item, i) => (
                <div key={item.title} className="mk-numbered-item">
                  <span className="mk-num">{String(i + 1).padStart(2, "0")}</span>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Banner: pain → solution transition ─────────────────── */}
        <div className="mk-banner">
          <div className="mk-banner-frame">
            <Image
              src="/home/event-setup.jpg"
              alt="Crew member anchoring a bounce house at a backyard event while kids wait to play"
              fill
              sizes="(max-width: 1200px) 100vw, 1112px"
            />
            <div className="mk-banner-overlay">
              <div>
                <span className="mk-eyebrow">{s.transitionBanner.kicker}</span>
                <h2>{s.transitionBanner.title}</h2>
              </div>
            </div>
          </div>
        </div>

        {/* ── How it works ───────────────────────────────────────── */}
        <section className="mk-section">
          <div className="mk-container">
            <div className="mk-section-head">
              <span className="mk-eyebrow">{s.howItWorks.kicker}</span>
              <h2>{s.howItWorks.title}</h2>
            </div>
            <div className="mk-numbered-grid">
              {s.howItWorks.steps.map((step, idx) => (
                <div key={step.title} className="mk-numbered-item">
                  <span className="mk-num">{String(idx + 1).padStart(2, "0")}</span>
                  <strong>{step.title}</strong>
                  <p>{formatMessage(step.body, { domain: appDomain })}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Benefits (outcome framing) ──────────────────────────── */}
        <section id="features" className="mk-band">
          <div className="mk-section">
            <div className="mk-container">
              <div className="mk-section-head">
                <span className="mk-eyebrow">{s.benefits.kicker}</span>
                <h2>{s.benefits.title}</h2>
              </div>
              <div className="mk-card-grid">
                {s.benefits.items.map((benefit) => (
                  <div key={benefit.title} className="mk-card">
                    <strong>{benefit.title}</strong>
                    <p>{benefit.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature showcase: customer + crew ──────────────────── */}
        <section className="mk-section">
          <div className="mk-container">
            <div className="mk-feature-row">
              <div className="mk-feature-image">
                <Image
                  src="/home/customer-booking-phone.jpg"
                  alt="A customer reserving a Castle Bounce House on their phone using the Korent storefront"
                  fill
                  sizes="(max-width: 860px) 100vw, 540px"
                />
              </div>
              <div className="mk-feature-copy">
                <span className="mk-eyebrow">{s.featureCustomer.kicker}</span>
                <h3>{s.featureCustomer.title}</h3>
                <p>{s.featureCustomer.body}</p>
              </div>
            </div>

            <div className="mk-feature-row reverse">
              <div className="mk-feature-image">
                <Image
                  src="/home/crew-loading-trailer.jpg"
                  alt="Two crew members in branded shirts loading an inflatable into a delivery trailer"
                  fill
                  sizes="(max-width: 860px) 100vw, 540px"
                />
              </div>
              <div className="mk-feature-copy">
                <span className="mk-eyebrow">{s.featureDelivery.kicker}</span>
                <h3>{s.featureDelivery.title}</h3>
                <p>{s.featureDelivery.body}</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Dashboard preview — the real product photo, not CSS
             mockups. ─────────────────────────────────────────────── */}
        <section className="mk-section--tight">
          <div className="mk-container mk-container--mid">
            <div className="mk-section-head">
              <span className="mk-eyebrow">{s.dashboardPreview.kicker}</span>
              <h2>{s.dashboardPreview.title}</h2>
              <p className="mk-muted">{s.dashboardPreview.subtitle}</p>
            </div>

            <div className="mk-product-shot" style={{ marginBottom: 28 }}>
              <Image
                src="/home/dashboard-tablet.jpg"
                alt="The Korent operator dashboard open on a tablet showing an order with delivery route and timeline"
                fill
                sizes="(max-width: 980px) 100vw, 932px"
              />
            </div>

            <div className="mk-card-grid mk-card-grid--2">
              <div className="mk-card">
                <span className="mk-eyebrow" style={{ marginBottom: 8 }}>{s.dashboardPreview.bookingCalendar}</span>
                <p>{s.dashboardPreview.bookingCalendarBody}</p>
              </div>
              <div className="mk-card">
                <span className="mk-eyebrow" style={{ marginBottom: 8 }}>{s.dashboardPreview.orderPipeline}</span>
                <p>{s.dashboardPreview.orderPipelineBody}</p>
              </div>
              <div className="mk-card">
                <span className="mk-eyebrow" style={{ marginBottom: 8 }}>{s.dashboardPreview.deliveryRoutes}</span>
                <p>{s.dashboardPreview.deliveryRoutesBody}</p>
              </div>
              <div className="mk-card">
                <span className="mk-eyebrow" style={{ marginBottom: 8 }}>{s.dashboardPreview.onlineCheckout}</span>
                <p>{s.dashboardPreview.onlineCheckoutBody}</p>
              </div>
            </div>

            <p style={{ textAlign: "center", margin: "30px 0 0" }}>
              <a href={demoUrl} rel="noopener noreferrer" className="mk-btn mk-btn--outline">
                {s.dashboardPreview.seeDemo}
              </a>
            </p>
          </div>
        </section>

        {/* ── ROI & positioning ──────────────────────────────────── */}
        <section className="mk-section">
          <div className="mk-container mk-container--mid">
            <div className="mk-section-head">
              <span className="mk-eyebrow">{s.roi.kicker}</span>
              <h2>{s.roi.title}</h2>
              <p className="mk-muted">{s.roi.body}</p>
            </div>
            <div className="mk-stat-row">
              {s.roi.stats.map((item) => (
                <div key={item.label} className="mk-stat">
                  <span className="mk-stat-value">{item.stat}</span>
                  <span className="mk-stat-label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Competitor comparison ──────────────────────────────── */}
        <section className="mk-section--tight">
          <div className="mk-container mk-container--narrow">
            <div className="mk-section-head">
              <span className="mk-eyebrow">{s.comparison.kicker}</span>
              <h2>{s.comparison.title}</h2>
            </div>
            <div className="mk-compare" role="table" aria-label={s.comparison.title}>
              <div className="mk-compare-row mk-compare-header" role="row">
                <div role="columnheader" />
                <div role="columnheader" className="mk-compare-cell mk-compare-korent">
                  {s.comparison.korentColumn}
                </div>
                <div role="columnheader" className="mk-compare-cell">
                  {s.comparison.otherColumn}
                </div>
              </div>
              {s.comparison.rows.map((feature) => (
                <div key={feature} className="mk-compare-row" role="row">
                  <div role="cell" className="mk-compare-feature">{feature}</div>
                  <div role="cell" className="mk-compare-cell">
                    <span className="mk-compare-mobile-label" aria-hidden="true">{s.comparison.korentColumn}</span>
                    <span className="mk-compare-check" aria-label={`${s.comparison.korentColumn}: yes`}>
                      <CheckIcon />
                    </span>
                  </div>
                  <div role="cell" className="mk-compare-cell">
                    <span className="mk-compare-mobile-label" aria-hidden="true">{s.comparison.otherColumn}</span>
                    <span className="mk-compare-dash" aria-label={`${s.comparison.otherColumn}: no`}>—</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────────────────── */}
        <section id="pricing" className="mk-section">
          <div className="mk-container">
            <div className="mk-section-head">
              <span className="mk-eyebrow">{s.pricingSection.kicker}</span>
              <h2>{s.pricingSection.title}</h2>
              <p className="mk-muted">{s.pricingSection.subtitle}</p>
            </div>

            <div className="mk-pricing-grid">
              {s.pricingSection.plans.map((plan, idx) => {
                const popular = idx === 2; // Pro plan
                return (
                  <div key={plan.name} className={`mk-plan${popular ? " mk-plan--popular" : ""}`}>
                    {popular && <span className="mk-plan-tag">{s.pricingSection.mostPopular}</span>}
                    <h3>{plan.name}</h3>
                    <div className="mk-plan-price">
                      {plan.price}
                      <span>{plan.period}</span>
                    </div>
                    <ul>
                      {plan.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                    <Link
                      href="/signup"
                      className={`mk-btn ${popular ? "mk-btn--accent" : "mk-btn--outline"}`}
                      style={{ width: "100%" }}
                    >
                      {plan.cta}
                    </Link>
                  </div>
                );
              })}
            </div>

            <div className="mk-trust-strip-inner" style={{ marginTop: 28, padding: 0 }}>
              {s.pricingSection.trustSignals.map((signal) => (
                <span key={signal}>{signal}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────── */}
        <section id="faq" className="mk-section--tight">
          <div className="mk-container mk-container--narrow">
            <div className="mk-section-head">
              <span className="mk-eyebrow">{s.faq.kicker}</span>
              <h2>{s.faq.title}</h2>
            </div>
            <div className="mk-faq">
              {s.faq.items.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Banner: inventory readiness ────────────────────────── */}
        <div className="mk-banner" style={{ marginTop: 32 }}>
          <div className="mk-banner-frame">
            <Image
              src="/home/inventory-warehouse.jpg"
              alt="A well-organized rental warehouse with neatly stacked inflatables, blowers, and equipment"
              fill
              sizes="(max-width: 1200px) 100vw, 1112px"
            />
            <div className="mk-banner-overlay">
              <div>
                <span className="mk-eyebrow">{s.inventoryBanner.kicker}</span>
                <h2>{s.inventoryBanner.title}</h2>
              </div>
            </div>
          </div>
        </div>

        {/* ── Final CTA ──────────────────────────────────────────── */}
        <section className="mk-closing">
          <h2>{s.finalCta.title}</h2>
          <p className="mk-lede">{s.finalCta.subtitle}</p>
          <Link href="/signup" className="mk-btn mk-btn--accent mk-btn--lg">
            {s.finalCta.ctaPrimary}
          </Link>
          <p style={{ marginTop: 16 }}>
            <a href={demoUrl} rel="noopener noreferrer" className="mk-text-link">
              {s.finalCta.demoLink}
            </a>
          </p>
          <p className="mk-closing-trust">{s.finalCta.trustLine}</p>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="mk-footer">
        <div className="mk-container">
          <div className="mk-footer-links">
            <a href="#features">{s.nav.features}</a>
            <a href="#pricing">{s.nav.pricing}</a>
            <a href="#faq">{s.nav.faq}</a>
            <Link href="/login">{s.nav.logIn}</Link>
            <Link href="/signup">{m.common.signUp}</Link>
            <a href="mailto:support@korent.app">{s.nav.contact}</a>
          </div>
          <div className="mk-footer-verticals">
            {verticals.map((vertical) => (
              <Link key={vertical.slug} href={`/${vertical.marketing.landingPageSlug}`}>
                {vertical.label.en} rental software
              </Link>
            ))}
          </div>
          <div className="mk-footer-tagline">{s.footer.tagline}</div>
        </div>
      </footer>
    </div>
  );
}
