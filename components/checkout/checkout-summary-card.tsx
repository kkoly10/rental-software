import Link from "next/link";

export type CheckoutPricing = {
  subtotal: number;
  deliveryFee: number | null;
  total: number | null;
  deposit: number | null;
};

export function CheckoutSummaryCard({
  productName,
  pricing,
  stripeEnabled,
}: {
  productName?: string;
  pricing?: CheckoutPricing;
  stripeEnabled?: boolean;
}) {
  const hasPricing = pricing && pricing.subtotal > 0;

  return (
    <aside className="panel storefront-summary-card">
      <div className="kicker">Reservation summary</div>
      <h2 style={{ margin: "8px 0 10px" }}>
        {productName ?? "Your inflatable reservation"}
      </h2>

      {hasPricing ? (
        <div className="list" style={{ marginTop: 16 }}>
          <div className="order-card">
            <div style={{ display: "grid", gap: 8 }}>
              <div className="order-row">
                <span className="muted">Subtotal</span>
                <span>${pricing.subtotal.toFixed(2)}</span>
              </div>
              <div className="order-row">
                <span className="muted">Delivery fee</span>
                <span>
                  {pricing.deliveryFee === null
                    ? "TBD"
                    : pricing.deliveryFee === 0
                      ? "Free"
                      : `$${pricing.deliveryFee.toFixed(2)}`}
                </span>
              </div>
              {pricing.total !== null && (
                <div
                  className="order-row"
                  style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}
                >
                  <strong>Total</strong>
                  <strong>${pricing.total.toFixed(2)}</strong>
                </div>
              )}
              {pricing.deposit !== null && pricing.deposit > 0 && (
                <div className="order-row">
                  <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                    Deposit due
                  </span>
                  <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                    ${pricing.deposit.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="muted" style={{ marginTop: 8 }}>
          {productName
            ? "Enter a delivery ZIP code to see your total with delivery fee."
            : "Select a product to see pricing."}
        </div>
      )}

      <div className="list" style={{ marginTop: 16 }}>
        <div className="order-card">
          <strong>What happens next</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            {stripeEnabled
              ? "After placing your booking, you'll be directed to our secure payment page to pay the deposit."
              : "After submission, we confirm availability and send agreement details. The operator will contact you about payment."}
          </div>
        </div>
        <div className="order-card">
          <strong>Delivery and setup</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            We deliver, set up, review safety basics, and return for pickup.
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
