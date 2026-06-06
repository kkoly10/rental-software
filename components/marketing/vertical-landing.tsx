import Link from "next/link";
import Image from "next/image";
import { MobileMenuToggle } from "@/components/layout/mobile-menu-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getTranslator } from "@/lib/i18n/server";
import type { VerticalConfig } from "@/lib/verticals/types";

/**
 * Vertical landing — Phase 2b template that any vertical's marketing
 * URL renders. Pulls hero / kicker / features from VerticalConfig.
 * Pricing, trust bar, FAQ, and final CTA come from i18n so they stay
 * consistent across verticals (the operator pain points are the same
 * whether you rent bounce houses or tents).
 *
 * Sections are intentionally fewer + tighter than the root SaaS
 * landing — this page exists to convert a Google searcher who typed
 * "<vertical> rental software", not to walk a curious visitor
 * through the entire product story.
 *
 * Phase 2c (next) registers tents / tables-and-chairs / dance-floors
 * verticals — each one renders the same template with its own config.
 */
export async function VerticalLanding({ vertical }: { vertical: VerticalConfig }) {
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || "korent.app";
  const isLocalDev = appDomain.startsWith("localhost") || appDomain.startsWith("127.0.0.1");
  const demoUrl = isLocalDev ? "#" : `https://demo.${appDomain}`;
  const { locale, messages: m } = await getTranslator();
  const s = m.saasLanding;
  const v = vertical.marketing;

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
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="saas-hero-grid">
          <div className="saas-hero-copy">
            <div className="kicker">{v.heroKicker}</div>
            <h1>{v.heroHeadline}</h1>
            <p className="muted">{v.heroSubhead}</p>

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
              src={vertical.imageSlugs.hero}
              alt={`Rental operator using Korent for ${vertical.label.en.toLowerCase()} rentals`}
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

        {/* ── Vertical-specific features ─────────────────────────── */}
        <section
          id="features"
          style={{
            padding: "72px 24px",
            maxWidth: 1100,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="kicker">Built for {vertical.label.en.toLowerCase()} operators</div>
            <h2>Why {vertical.label.en.toLowerCase()} businesses pick Korent</h2>
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

        {/* ── How it works (shared, generic) ─────────────────────── */}
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

        {/* ── FAQ (shared) ───────────────────────────────────────── */}
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
