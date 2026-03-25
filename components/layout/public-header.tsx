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
          <Link href="/checkout">Reserve</Link>
        </nav>

        <div className="public-nav-right">
          <div className="public-status-pill">Choose date &amp; ZIP</div>
          <Link href="/inventory" className="secondary-btn">
            Browse Rentals
          </Link>
        </div>
      </div>
    </header>
  );
}