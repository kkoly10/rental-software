import Link from "next/link";

export function ServiceAreaSection() {
  return (
    <section className="section">
      <div className="container">
        <div className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Service area</div>
              <h2 style={{ margin: "6px 0 8px" }}>Delivered across your local market</h2>
              <div className="muted">
                We serve neighborhood parties, school events, and church gatherings across our primary delivery zone.
              </div>
            </div>
          </div>

          <div className="grid grid-3">
            <div className="order-card">
              <strong>Primary ZIP coverage</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Stafford, Fredericksburg, and surrounding delivery-ready areas.
              </div>
            </div>
            <div className="order-card">
              <strong>Setup support</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                We deliver, set up, review safety basics, and return for pickup.
              </div>
            </div>
            <div className="order-card">
              <strong>Need help first?</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Check the catalog, then contact us for custom packages or event guidance.
              </div>
              <div style={{ marginTop: 14 }}>
                <Link href="/inventory" className="secondary-btn">Browse Catalog</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
