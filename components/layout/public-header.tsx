import Link from "next/link";
import { getBrandSettings } from "@/lib/data/brand";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getOrgContext } from "@/lib/auth/org-context";
import { MobileMenuToggle } from "./mobile-menu-toggle";

export async function PublicHeader({ logoUrl }: { logoUrl?: string } = {}) {
  const [brand, settings, orgCtx] = await Promise.all([
    getBrandSettings(),
    getOrganizationSettings(),
    getOrgContext(),
  ]);
  const resolvedLogoUrl = logoUrl ?? brand.logoUrl;
  const isOperator = !!orgCtx;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  return (
    <>
      {isOperator && (
        <div className="operator-bar">
          <div className="container operator-bar-inner">
            <span className="operator-bar-badge">Operator View</span>
            <span className="operator-bar-name">{settings.businessName}</span>
            <a href={`${siteUrl}/dashboard`} className="operator-bar-link">
              Dashboard &rarr;
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
            <Link href="/inventory">Catalog</Link>
            <Link href="/#how-it-works">How It Works</Link>
            <Link href="/#service-area">Service Area</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/order-status">Order Status</Link>
            <Link href="/contact">Contact</Link>
          </nav>

          <div className="public-nav-right">
            {isOperator ? (
              <a href={`${siteUrl}/dashboard`} className="ghost-btn public-nav-auth-btn">
                Dashboard
              </a>
            ) : (
              <a href={`${siteUrl}/login`} className="ghost-btn public-nav-auth-btn">
                Rentals Login
              </a>
            )}
            <Link
              href="/inventory"
              className="primary-btn public-nav-book-btn"
            >
              Book Now
            </Link>
          </div>

          <MobileMenuToggle isOperator={isOperator} siteUrl={siteUrl} />
        </div>
      </header>
    </>
  );
}
