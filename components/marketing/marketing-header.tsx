import Link from "next/link";
import { MobileMenuToggle } from "@/components/layout/mobile-menu-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getTranslator } from "@/lib/i18n/server";

export type MarketingNavLink = { key: string; label: string; href: string };

/**
 * Shared marketing-page header (mk-page chrome). Used by SaasLanding,
 * VerticalLanding, and /pricing so the nav exists in exactly one place.
 * Anchor links should be absolute ("/#features") on subpages so they
 * resolve back to the homepage sections.
 */
export async function MarketingHeader({ navLinks }: { navLinks: MarketingNavLink[] }) {
  const { locale, messages: m } = await getTranslator();
  const s = m.saasLanding;

  return (
    <header className="mk-header">
      <div className="mk-header-inner">
        <Link href="/" aria-label="Korent home" style={{ display: "block" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Korent" style={{ height: 34, width: "auto", display: "block" }} />
        </Link>
        <nav className="saas-header-nav">
          {navLinks.map((link) => (
            <a key={link.key} href={link.href} className="mk-nav-link">
              {link.label}
            </a>
          ))}
          <LanguageSwitcher currentLocale={locale} ariaLabel={m.language.label} />
          <Link href="/login" className="mk-btn mk-btn--outline">{s.nav.logIn}</Link>
          <Link href="/signup" className="mk-btn mk-btn--accent">{s.nav.startFree}</Link>
        </nav>
        <div className="mobile-header-controls">
          <LanguageSwitcher currentLocale={locale} ariaLabel={m.language.label} compact />
          <MobileMenuToggle
            isOperator={false}
            navLinks={navLinks}
            cta={{ label: s.nav.startFree, href: "/signup" }}
            authLabel={s.nav.logIn}
            currentLocale={locale}
            languageLabel={m.language.label}
          />
        </div>
      </div>
    </header>
  );
}
