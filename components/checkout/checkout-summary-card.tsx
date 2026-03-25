import Link from "next/link";

export function CheckoutSummaryCard({
  productName,
}: {
  productName?: string;
}) {
  return (
    <aside className="panel storefront-summary-card">
      <div className="kicker">Reservation summary</div>
      <h2 style={{ margin: "8px 0 10px" }}>
        {productName ?? "Your inflatable reservation"}
      </h2>
      <div className="muted">
        A deposit reserves your date. Our team confirms delivery timing, setup
        notes, and final event details after booking.
      </div>

      <div className="list" style={{ marginTop: 16 }}>
        <div className="order-card">
          <strong>Deposit due today</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            A partial payment secures the booking window.
          </div>
        </div>
        <div className="order-card">
          <strong>Delivery and setup</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            We deliver, set up, review safety basics, and return for pickup.
          </div>
        </div>
        <div className="order-card">
          <strong>Next step</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            After submission, we confirm availability and send agreement details.
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <Link href="/inventory" className="secondary-btn">
          Back to catalog
        </Link>
      </div>
    </aside>
  );
}
