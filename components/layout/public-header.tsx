import Link from "next/link";
import { getBrandSettings } from "@/lib/data/brand";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getOrgContext } from "@/lib/auth/org-context";
import { getContentSettings } from "@/lib/data/content-settings";
import { MobileMenuToggle } from "./mobile-menu-toggle";
import { LanguageSwitcher } from "./language-switcher";
import { getTranslator } from "@/lib/i18n/server";

export async function PublicHeader({ logoUrl }: { logoUrl?: string } = {}) {
  const [brand, settings, orgCtx, contentSettings, { locale, messages }] = await Promise.all([
    getBrandSettings(),
    getOrganizationSettings(),
    getOrgContext(),
    getContentSettings(),
    getTranslator(),
  ]);
  const visibleNavLinks = contentSettings.navLinks.filter((l) => l.visible);
  const resolvedLogoUrl = logoUrl ?? brand.logoUrl;
  const isOperator = !!orgCtx;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const m = messages;

  return (
    <>
      {isOperator && (
        <div className="operator-bar">
          <div className="container operator-bar-inner">
            <span className="operator-bar-badge">{m.nav.operatorView}</span>
            <span className="operator-bar-name">{settings.businessName}</span>
            <a href={`${siteUrl}/dashboard`} className="operator-bar-link">
              {m.nav.dashboard} &rarr;
            </a>
          </div>
        </div>
      )}
      <header className="topbar public-topbar">
        <div className="container topbar-inner">
          <Link href="/" className="logo public-logo">
            {resolvedLogoUrl ? (
              <img
                src={resolvedLogoUrl}
                alt={`${settings.businessName} logo`}
                style={{ maxHeight: 40, width: "auto", display: "block" }}
              />
            ) : (
              settings.businessName
            )}
          </Link>

          <nav className="nav-links public-nav-links public-nav-desktop">
            {visibleNavLinks.map((link) => (
              <Link key={link.key} href={link.href}>{link.label}</Link>
            ))}
          </nav>

          <div className="public-nav-right">
            <LanguageSwitcher currentLocale={locale} ariaLabel={m.language.label} />
            {isOperator ? (
              <a href={`${siteUrl}/dashboard`} className="ghost-btn public-nav-auth-btn">
                {m.nav.dashboard}
              </a>
            ) : (
              <a href={`${siteUrl}/login`} className="ghost-btn public-nav-auth-btn">
                {m.nav.rentalsLogin}
              </a>
            )}
            <Link
              href="/inventory"
              className="primary-btn public-nav-book-btn"
            >
              {m.common.bookNow}
            </Link>
          </div>

          <MobileMenuToggle
            isOperator={isOperator}
            siteUrl={siteUrl}
            navLinks={visibleNavLinks}
            authLabel={m.nav.rentalsLogin}
            dashboardLabel={m.nav.dashboard}
            cta={{ label: m.common.bookNow, href: "/inventory" }}
            menuLabel={m.common.menu}
            openMenuLabel={m.common.openMenu}
            closeMenuLabel={m.common.closeMenu}
            currentLocale={locale}
            languageLabel={m.language.label}
          />
        </div>
      </header>
    </>
  );
}
