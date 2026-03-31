import Link from "next/link";
import { getBrandSettings } from "@/lib/data/brand";

export async function PublicHeader({ logoUrl }: { logoUrl?: string } = {}) {
  const brand = await getBrandSettings();
  const resolvedLogoUrl = logoUrl ?? brand.logoUrl;
  return (
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
            "Bounce Back Rentals"
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
          <Link href="/login" className="ghost-btn" style={{ fontSize: 14 }}>
            Rentals Login
          </Link>
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
  );
}