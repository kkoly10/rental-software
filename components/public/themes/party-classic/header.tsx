import Link from "next/link";
import { getBrandSettings } from "@/lib/data/brand";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getOrgContext } from "@/lib/auth/org-context";
import { getContentSettings } from "@/lib/data/content-settings";
import { MobileMenuToggle } from "@/components/layout/mobile-menu-toggle";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getTranslator } from "@/lib/i18n/server";
import { sanitizeHref } from "@/lib/utils/safe-href";
import { getThemeSettings } from "@/lib/data/theme-settings";

function formatPhoneCompact(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return raw;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export async function PartyClassicHeader() {
  const [brand, settings, orgCtx, contentSettings, theme, { locale, messages }] = await Promise.all([
    getBrandSettings(),
    getOrganizationSettings(),
    getOrgContext(),
    getContentSettings(),
    getThemeSettings(),
    getTranslator(),
  ]);
  const visibleNavLinks = contentSettings.navLinks.filter((l) => l.visible);
  const isOperator = !!orgCtx;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const m = messages;
  const showPhone = theme.headerPhoneVisible && settings.phone && settings.phone !== "(555) 000-0000";
  const phoneDisplay = showPhone ? formatPhoneCompact(settings.phone) : "";

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
      <header className="st-header">
        <div className="st-container st-nav">
          <Link href="/" className="st-logo">
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt={`${settings.businessName} logo`} className="st-logo-img" />
            ) : (
              <>
                <span className="st-logo-mark">
                  {settings.businessName ? settings.businessName.charAt(0).toUpperCase() : "·"}
                </span>
                <span>{settings.businessName}</span>
              </>
            )}
          </Link>

          <nav className="st-nav-links">
            {visibleNavLinks.map((link) => (
              <Link key={link.key} href={sanitizeHref(link.href)}>
                {link.label}
              </Link>
            ))}
            {showPhone && (
              <a href={`tel:${settings.phone.replace(/\D/g, "")}`} className="st-nav-phone">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
                {phoneDisplay}
              </a>
            )}
          </nav>

          <div className="st-nav-right">
            <LanguageSwitcher currentLocale={locale} ariaLabel={m.language.label} />
            {showPhone && (
              <a
                href={`tel:${settings.phone.replace(/\D/g, "")}`}
                className="st-mobile-phone st-mobile-only"
                aria-label={m.nav.call ?? "Call"}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                </svg>
                {m.nav.call ?? "Call"}
              </a>
            )}
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
        </div>
      </header>
    </>
  );
}
