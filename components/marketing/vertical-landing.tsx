import Link from "next/link";
import Image from "next/image";
import { MobileMenuToggle } from "@/components/layout/mobile-menu-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getTranslator } from "@/lib/i18n/server";
import { getVerticalLandingCopy } from "@/lib/verticals/landing-copy";
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
 *   5. Vertical-specific feature grid (from VerticalConfig.marketing)
 *   6. How it works (shared workflow)
 *   7. Pricing teaser — transparent from-price (competitors hide theirs)
 *   8. Per-vertical FAQ (People-Also-Ask intent + product questions)
 *   9. Final CTA with seasonal-urgency closer
 *
 * Deliberately no testimonial section yet: we have no named operators
 * to quote and will not fabricate social proof. Slot it between 6 and
 * 7 when real quotes exist.
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
          <a href="#features" className="ghost-btn">{s.nav.features}</a>
          <Link href="/pricing" className="ghost-btn">{s.nav.pricing}</Link>
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
      </header>

      <main>
        {/* ── 1. Hero — exact-match H1, outcome subhead, dual CTA ── */}
        <section className="saas-hero-grid">
          <div className="saas-hero-copy">
            <div className="kicker">{v.heroKicker}</div>
            <h1>{copy.h1}</h1>
            <p className="muted">{copy.sub}</p>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <Link
                href="/signup"
                className="primary-btn"
                style={{ fontSize: "1.1rem", padding: "14px 36px", display: "inline-block" }}
              >
                {s.hero.ctaPrimary}
              </Link>
              <a
                href={demoUrl}
                rel="noopener noreferrer"
                className="secondary-btn"
                style={{ fontSize: "1rem", padding: "13px 24px", display: "inline-block" }}
              >
                See a live demo storefront →
              </a>
            </div>
          </div>

          <div className="saas-hero-image">
            <Image
              src={vertical.imageSlugs.hero}
              alt={`Rental operator using Korent for ${verticalLabel} rentals`}
              fill
              priority
              sizes="(max-width: 860px) 100vw, 540px"
            />
          </div>
        </section>

        {/* ── 2. Trust strip — proof at the decision moment ──────── */}
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

        {/* ── 3. Product visual — show the storefront, link the demo ── */}
        {storefrontShot && (
          <section
            style={{
              padding: "72px 24px 64px",
              maxWidth: 1000,
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <div className="kicker">Your storefront, not ours</div>
            <h2 style={{ margin: "8px 0 12px" }}>
              A booking site your customers use without calling you
            </h2>
            <p className="muted" style={{ maxWidth: 560, margin: "0 auto 32px" }}>
              Every Korent plan includes a branded storefront on your own
              subdomain — real-time availability, online deposits, and
              checkout built for {verticalLabel}.
            </p>
            <a
              href={demoUrl}
              rel="noopener noreferrer"
              aria-label="Open the live demo storefront"
              style={{ display: "block", maxWidth: 880, margin: "0 auto" }}
            >
              <span
                style={{
                  display: "block",
                  borderRadius: 14,
                  overflow: "hidden",
                  border: "1px solid var(--border, #e5e7eb)",
                  boxShadow: "0 18px 50px -24px rgba(15, 31, 51, 0.35)",
                  position: "relative",
                  aspectRatio: "16 / 9",
                }}
              >
                <Image
                  src={storefrontShot}
                  alt={`A Korent ${verticalLabel} storefront`}
                  fill
                  sizes="(max-width: 920px) 100vw, 880px"
                  style={{ objectFit: "cover" }}
                />
              </span>
            </a>
            <p style={{ marginTop: 16 }}>
              <a
                href={demoUrl}
                rel="noopener noreferrer"
                style={{ color: "var(--primary, #2563eb)", fontWeight: 600, fontSize: "0.95rem" }}
              >
                Click around the live demo — no signup needed →
              </a>
            </p>
          </section>
        )}

        {/* ── 4. The hard way vs the Korent way ──────────────────── */}
        <section
          style={{
            padding: "56px 24px 72px",
            maxWidth: 1000,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div className="kicker">{copy.hardWayTitle}</div>
            <h2>The hard way vs. the Korent way</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {copy.rows.map((row) => (
              <div
                key={row.hard}
                className="grid grid-2 stat-grid-responsive"
                style={{ gap: 14 }}
              >
                <div
                  className="panel"
                  style={{
                    padding: 20,
                    background: "var(--surface-soft, #f8f9fa)",
                    borderStyle: "dashed",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-muted, #6b7280)",
                      marginBottom: 6,
                    }}
                  >
                    The hard way
                  </span>
                  <p className="muted" style={{ margin: 0, fontSize: "0.92rem" }}>
                    {row.hard}
                  </p>
                </div>
                <div className="panel" style={{ padding: 20 }}>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--primary, #2563eb)",
                      marginBottom: 6,
                    }}
                  >
                    The Korent way
                  </span>
                  <p style={{ margin: 0, fontSize: "0.92rem" }}>{row.korent}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 5. Vertical-specific feature grid ──────────────────── */}
        <section
          id="features"
          style={{
            padding: "64px 24px 72px",
            maxWidth: 1100,
            margin: "0 auto",
            borderTop: "1px solid var(--border, #e5e7eb)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="kicker">Built for {verticalLabel} operators</div>
            <h2>Why {verticalLabel} businesses pick Korent</h2>
          </div>

          <div className="grid grid-3 stat-grid-responsive" style={{ gap: 20 }}>
            {v.features.map((feature) => (
              <div key={feature.title} className="panel" style={{ padding: 24 }}>
                <strong style={{ fontSize: "0.98rem" }}>{feature.title}</strong>
                <p className="muted" style={{ marginTop: 8, fontSize: "0.9rem" }}>
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 6. How it works (shared workflow) ──────────────────── */}
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
                <p className="muted">{step.body.replace("{domain}", appDomain)}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 7. Pricing teaser — transparency competitors avoid ─── */}
        <section
          style={{
            padding: "64px 24px",
            maxWidth: 680,
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div className="kicker">{s.nav.pricing}</div>
          <h2 style={{ margin: "8px 0 12px" }}>From $49/month. No per-booking fees.</h2>
          <p className="muted" style={{ marginBottom: 24 }}>
            Every plan includes the booking storefront, online payments,
            inventory holds, crew scheduling, and waivers. Card processing
            by Stripe at standard rates — Korent doesn&rsquo;t take a cut of
            your bookings.
          </p>
          <Link href="/pricing" className="secondary-btn" style={{ display: "inline-block" }}>
            See full pricing →
          </Link>
        </section>

        {/* ── 8. Per-vertical FAQ (PAA intent + product) ─────────── */}
        <section
          id="faq"
          style={{
            padding: "24px 24px 60px",
            maxWidth: 720,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="kicker">{s.faq.kicker}</div>
            <h2>{s.faq.title}</h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {copy.faqs.map((item) => (
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

        {/* ── 9. Final CTA — seasonal urgency closer ─────────────── */}
        <section
          style={{
            textAlign: "center",
            padding: "72px 24px 88px",
            maxWidth: 600,
            margin: "0 auto",
          }}
        >
          <h2 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", margin: "0 0 16px" }}>
            {copy.closer}
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

          <p className="muted" style={{ marginTop: 20, fontSize: "0.82rem" }}>
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
          <Link href="/pricing" style={{ color: "inherit" }}>{s.nav.pricing}</Link>
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
