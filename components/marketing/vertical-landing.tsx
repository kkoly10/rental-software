import Link from "next/link";
import Image from "next/image";
import { MobileMenuToggle } from "@/components/layout/mobile-menu-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getTranslator } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/format";
import { getVerticalLandingCopy } from "@/lib/verticals/landing-copy";
import { listVerticals } from "@/lib/verticals/registry";
import type { VerticalConfig } from "@/lib/verticals/types";

/**
 * Vertical landing — the SEO page each "<vertical> rental software"
 * query lands on. Section order follows the 2026 research synthesis
 * (Booqable + Goodshuffle Pro vertical-page teardowns + CRO consensus,
 * see lib/verticals/landing-copy.ts):
 *
 *   1. Hero — exact-match H1, outcome subhead, dual CTA (trial-first)
 *   2. Trust strip directly under the hero (proof at the decision moment)
 *   3. Product visual — the vertical's real storefront + live demo link
 *   4. "The hard way vs the Korent way" comparison
 *   5. Scenic photo banner — the vertical's own event imagery
 *   6. Vertical-specific feature grid (from VerticalConfig.marketing)
 *   7. Crew/delivery feature row — the vertical's own crew-at-work photo
 *   8. How it works (shared workflow)
 *   9. Pricing teaser — transparent from-price (competitors hide theirs)
 *  10. Per-vertical FAQ (People-Also-Ask intent + product questions)
 *  11. Final CTA with seasonal-urgency closer
 *
 * Styling: app/marketing.css (mk-* classes) — the storefront's editorial
 * language. Deliberately no testimonial section: we have no named
 * operators to quote and will not fabricate social proof. Slot it
 * between 8 and 9 when real quotes exist.
 */
export async function VerticalLanding({ vertical }: { vertical: VerticalConfig }) {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "korent.app";
  const isLocalDev = appDomain.startsWith("localhost") || appDomain.startsWith("127.0.0.1");
  const demoUrl = isLocalDev ? "#" : `https://demo.${appDomain}`;
  const { locale, messages: m } = await getTranslator();
  const s = m.saasLanding;
  const v = vertical.marketing;
  const copy = getVerticalLandingCopy(vertical.slug);
  const verticalLabel = vertical.label.en.toLowerCase();
  const storefrontShot = vertical.storefrontDefaults?.heroImagePath;
  const bannerImage = vertical.imageSlugs.transitionBanner;
  const crewImage = vertical.imageSlugs.crew;

  return (
    <div className="mk-page">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="mk-header">
        <div className="mk-header-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Korent" style={{ height: 34, width: "auto", display: "block" }} />
          <nav className="saas-header-nav">
            <a href="#features" className="mk-nav-link">{s.nav.features}</a>
            <Link href="/pricing" className="mk-nav-link">{s.nav.pricing}</Link>
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
                { key: "features", label: s.nav.features, href: "#features" },
                { key: "pricing", label: s.nav.pricing, href: "/pricing" },
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
        {/* ── 1. Hero — exact-match H1, outcome subhead, dual CTA ── */}
        <section className="mk-hero">
          <div className="mk-hero-copy">
            <span className="mk-eyebrow">{v.heroKicker}</span>
            <h1>{copy.h1}</h1>
            <p className="mk-lede">{copy.sub}</p>
            <div className="mk-hero-actions">
              <Link href="/signup" className="mk-btn mk-btn--accent mk-btn--lg">
                {s.hero.ctaPrimary}
              </Link>
              <a href={demoUrl} rel="noopener noreferrer" className="mk-btn mk-btn--outline">
                See a live demo storefront →
              </a>
            </div>
          </div>
          <div className="mk-hero-image">
            <Image
              src={vertical.imageSlugs.hero}
              alt={`${vertical.label.en} rental operator managing bookings with Korent`}
              fill
              priority
              sizes="(max-width: 860px) 100vw, 520px"
            />
          </div>
        </section>

        {/* ── 2. Trust strip — proof at the decision moment ──────── */}
        <section className="mk-trust-strip">
          <div className="mk-trust-strip-inner">
            {s.trustBar.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        {/* ── 3. Product visual — show the storefront, link the demo ── */}
        {storefrontShot && (
          <section className="mk-section--tight" style={{ paddingTop: 72 }}>
            <div className="mk-container mk-container--mid" style={{ textAlign: "center" }}>
              <div className="mk-section-head" style={{ marginBottom: 36 }}>
                <span className="mk-eyebrow">Your storefront, not ours</span>
                <h2>A booking site your customers use without calling you</h2>
                <p className="mk-muted">
                  Every Korent plan includes a branded storefront on your own
                  subdomain — real-time availability, online deposits, and
                  checkout built for {verticalLabel}.
                </p>
              </div>
              <a
                href={demoUrl}
                rel="noopener noreferrer"
                aria-label="Open the live demo storefront"
                style={{ display: "block", maxWidth: 880, margin: "0 auto" }}
              >
                <span className="mk-product-shot">
                  <Image
                    src={storefrontShot}
                    alt={`A Korent ${verticalLabel} storefront`}
                    fill
                    sizes="(max-width: 920px) 100vw, 880px"
                  />
                </span>
              </a>
              <p style={{ marginTop: 18 }}>
                <a href={demoUrl} rel="noopener noreferrer" className="mk-text-link">
                  Click around the live demo — no signup needed →
                </a>
              </p>
            </div>
          </section>
        )}

        {/* ── 4. The hard way vs the Korent way ──────────────────── */}
        <section className="mk-section">
          <div className="mk-container mk-container--mid">
            <div className="mk-section-head">
              <span className="mk-eyebrow">{copy.hardWayTitle}</span>
              <h2>The hard way vs. the Korent way</h2>
            </div>
            <div>
              {copy.rows.map((row) => (
                <div key={row.hard} className="mk-versus-row">
                  <div className="mk-versus-cell">
                    <span className="mk-versus-label">The hard way</span>
                    <p>{row.hard}</p>
                  </div>
                  <div className="mk-versus-cell mk-versus-cell--korent">
                    <span className="mk-versus-label">The Korent way</span>
                    <p>{row.korent}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 5. Scenic banner — the vertical's own event imagery ── */}
        {bannerImage && (
          <div className="mk-banner">
            <div className="mk-banner-frame">
              <Image
                src={bannerImage}
                alt={`${vertical.label.en} rental set up at a live event`}
                fill
                sizes="(max-width: 1200px) 100vw, 1112px"
              />
              <div className="mk-banner-overlay">
                <div>
                  <span className="mk-eyebrow">{vertical.label.en}</span>
                  <h2>{s.transitionBanner.title}</h2>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 6. Vertical-specific feature grid ──────────────────── */}
        <section id="features" className="mk-section">
          <div className="mk-container">
            <div className="mk-section-head">
              <span className="mk-eyebrow">Built for {verticalLabel} operators</span>
              <h2>Why {verticalLabel} businesses pick Korent</h2>
            </div>
            <div className="mk-card-grid">
              {v.features.map((feature) => (
                <div key={feature.title} className="mk-card">
                  <strong>{feature.title}</strong>
                  <p>{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 7. Crew/delivery feature row — vertical's own photo ── */}
        {crewImage && (
          <section className="mk-section--tight">
            <div className="mk-container">
              <div className="mk-feature-row reverse">
                <div className="mk-feature-image">
                  <Image
                    src={crewImage}
                    alt={`Crew preparing ${verticalLabel} rentals for delivery`}
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
        )}

        {/* ── 8. How it works (shared workflow) ──────────────────── */}
        <section className="mk-band">
          <div className="mk-section">
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
          </div>
        </section>

        {/* ── 9. Pricing teaser — transparency competitors avoid ─── */}
        <section className="mk-section">
          <div className="mk-container mk-container--narrow" style={{ textAlign: "center" }}>
            <span className="mk-eyebrow">{s.nav.pricing}</span>
            <h2 style={{ margin: "0 0 14px" }}>From $49/month. No per-booking fees.</h2>
            <p className="mk-muted" style={{ maxWidth: 560, margin: "0 auto 26px" }}>
              Every plan includes the booking storefront, online payments,
              inventory holds, crew scheduling, and waivers. Card processing
              by Stripe at standard rates — Korent doesn&rsquo;t take a cut of
              your bookings.
            </p>
            <Link href="/pricing" className="mk-btn mk-btn--outline">
              See full pricing →
            </Link>
          </div>
        </section>

        {/* ── 10. Per-vertical FAQ (PAA intent + product) ────────── */}
        <section id="faq" className="mk-section--tight">
          <div className="mk-container mk-container--narrow">
            <div className="mk-section-head">
              <span className="mk-eyebrow">{s.faq.kicker}</span>
              <h2>{s.faq.title}</h2>
            </div>
            <div className="mk-faq">
              {copy.faqs.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── 11. Final CTA — seasonal urgency closer ────────────── */}
        <section className="mk-closing">
          <h2>{copy.closer}</h2>
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

        {/* ── Sibling verticals — internal-linking mesh. Every vertical
             page links the other five so link equity circulates among
             the SEO set and multi-line operators find their other
             business. ─────────────────────────────────────────────── */}
        <section className="mk-section--tight" style={{ borderTop: "1px solid var(--mk-line)" }}>
          <div className="mk-container" style={{ textAlign: "center" }}>
            <span className="mk-eyebrow" style={{ marginBottom: 16 }}>Korent also runs</span>
            <div className="mk-sibling-links">
              {listVerticals()
                .filter((sibling) => sibling.slug !== vertical.slug)
                .map((sibling) => (
                  <Link key={sibling.slug} href={`/${sibling.marketing.landingPageSlug}`}>
                    {sibling.label.en} rental software
                  </Link>
                ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="mk-footer">
        <div className="mk-container">
          <div className="mk-footer-links">
            <a href="#features">{s.nav.features}</a>
            <Link href="/pricing">{s.nav.pricing}</Link>
            <a href="#faq">{s.nav.faq}</a>
            <Link href="/login">{s.nav.logIn}</Link>
            <Link href="/signup">{m.common.signUp}</Link>
            <a href="mailto:support@korent.app">{s.nav.contact}</a>
          </div>
          <div className="mk-footer-tagline">{s.footer.tagline}</div>
        </div>
      </footer>
    </div>
  );
}
