import Link from "next/link";

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer">
      <div className="container">
        <div className="panel" style={{ padding: 28 }}>
          <div className="footer-grid">
            <div>
              <div className="kicker" style={{ marginBottom: 10 }}>Bounce Back Rentals</div>
              <div className="muted" style={{ lineHeight: 1.65, maxWidth: 260 }}>
                Clean, safe, professionally delivered inflatable rentals for birthdays, school events, and church gatherings.
              </div>
              <div style={{ marginTop: 16 }}>
                <div className="muted" style={{ fontSize: 13 }}>
                  Serving Stafford, Fredericksburg & surrounding areas
                </div>
              </div>
            </div>

            <div>
              <strong style={{ fontSize: 13 }}>Browse</strong>
              <div className="list" style={{ marginTop: 10 }}>
                <Link href="/inventory" className="muted">Full Catalog</Link>
                <Link href="/inventory?category=bounce-houses" className="muted">Bounce Houses</Link>
                <Link href="/inventory?category=water-slides" className="muted">Water Slides</Link>
                <Link href="/inventory?category=packages" className="muted">Party Packages</Link>
              </div>
            </div>

            <div>
              <strong style={{ fontSize: 13 }}>Company</strong>
              <div className="list" style={{ marginTop: 10 }}>
                <a href="#how-it-works" className="muted">How It Works</a>
                <Link href="/pricing" className="muted">Pricing</Link>
                <Link href="/order-status" className="muted">Order Status</Link>
                <a href="#service-area" className="muted">Service Area</a>
              </div>
            </div>

            <div>
              <strong style={{ fontSize: 13 }}>For Operators</strong>
              <div className="list" style={{ marginTop: 10 }}>
                <Link href="/signup" className="muted">Create Account</Link>
                <Link href="/login" className="muted">Operator Login</Link>
                <Link href="/pricing" className="muted">Plans & Pricing</Link>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <div className="muted" style={{ fontSize: 12 }}>
              &copy; {year} Bounce Back Rentals. All rights reserved.
            </div>
            <div className="footer-bottom-links">
              <span className="muted" style={{ fontSize: 12 }}>Privacy</span>
              <span className="muted" style={{ fontSize: 12 }}>Terms</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
