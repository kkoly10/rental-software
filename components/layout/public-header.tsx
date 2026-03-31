import Link from "next/link";
import { getBrandSettings } from "@/lib/data/brand";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getOrgContext } from "@/lib/auth/org-context";

export async function PublicHeader({ logoUrl }: { logoUrl?: string } = {}) {
  const [brand, settings, orgCtx] = await Promise.all([
    getBrandSettings(),
    getOrganizationSettings(),
    getOrgContext(),
  ]);
  const resolvedLogoUrl = logoUrl ?? brand.logoUrl;
  const isOperator = !!orgCtx;

  return (
    <>
      {isOperator && (
        <div className="operator-bar">
          <div className="container operator-bar-inner">
            <span className="operator-bar-badge">Operator View</span>
            <span className="operator-bar-name">{settings.businessName}</span>
            <Link href="/dashboard" className="operator-bar-link">
              Dashboard &rarr;
            </Link>
          </div>
        </div>
      )}
      <header className="topbar public-topbar">
        <div className="container topbar-inner">
          <Link href="/" className="logo public-logo">
            {resolvedLogoUrl ? (
              <img
                src={resolvedLogoUrl}
                alt="Logo"
                style={{ maxHeight: 40, width: "auto", display: "block" }}
              />
            ) : (
              settings.businessName
            )}
          </Link>

          <nav className="nav-links public-nav-links">
            <Link href="/inventory">Catalog</Link>
            <a href="#how-it-works">How It Works</a>
            <a href="#service-area">Service Area</a>
            <Link href="/pricing">Pricing</Link>
            <Link href="/order-status">Order Status</Link>
            <Link href="/contact">Contact</Link>
          </nav>

          <div className="public-nav-right">
            {isOperator ? (
              <Link href="/dashboard" className="ghost-btn" style={{ fontSize: 14 }}>
                Dashboard
              </Link>
            ) : (
              <Link href="/login" className="ghost-btn" style={{ fontSize: 14 }}>
                Rentals Login
              </Link>
            )}
            <Link
              href="/inventory"
              className="primary-btn"
              style={{ background: "#f97316", minHeight: 42 }}
            >
              Book Now
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
