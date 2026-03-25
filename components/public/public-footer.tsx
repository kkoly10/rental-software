import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="panel" style={{ padding: 24 }}>
          <div className="grid grid-4">
            <div>
              <div className="kicker">Bounce Back Rentals</div>
              <div className="muted" style={{ marginTop: 10 }}>
                Clean, safe, professionally delivered inflatable rentals for birthdays, school events, and church gatherings.
              </div>
            </div>
            <div>
              <strong>Browse</strong>
              <div className="list" style={{ marginTop: 10 }}>
                <Link href="/inventory" className="muted">Catalog</Link>
                <Link href="/inventory?category=water-slides" className="muted">Water Slides</Link>
                <Link href="/inventory?category=packages" className="muted">Packages</Link>
              </div>
            </div>
            <div>
              <strong>Help</strong>
              <div className="list" style={{ marginTop: 10 }}>
                <a href="#how-it-works" className="muted">How It Works</a>
                <a href="#service-area" className="muted">Service Area</a>
                <Link href="/checkout" className="muted">Reserve Now</Link>
              </div>
            </div>
            <div>
              <strong>Business</strong>
              <div className="list" style={{ marginTop: 10 }}>
                <div className="muted">Serving Stafford and nearby delivery areas</div>
                <Link href="/login" className="muted">Operator Login</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
