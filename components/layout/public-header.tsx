import Link from "next/link";

export function PublicHeader() {
  return (
    <header className="topbar public-topbar">
      <div className="container topbar-inner">
        <Link href="/" className="logo public-logo">
          Bounce Back Rentals
        </Link>

        <nav className="nav-links public-nav-links">
          <Link href="/inventory">Catalog</Link>
          <a href="#how-it-works">How It Works</a>
          <a href="#service-area">Service Area</a>
          <Link href="/pricing">Pricing</Link>
          <Link href="/checkout">Reserve</Link>
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