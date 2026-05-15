import Link from "next/link";
import { getMessages } from "@/lib/i18n/server";

export type CheckoutPricing = {
  basePrice: number;
  adjustments: { ruleName: string; amount: number; percentage: number }[];
  subtotal: number;
  deliveryFee: number | null;
  total: number | null;
  deposit: number | null;
};

export async function CheckoutSummaryCard({
  productName,
  pricing,
  stripeEnabled,
  cancellationPolicy,
}: {
  productName?: string;
  pricing?: CheckoutPricing;
  stripeEnabled?: boolean;
  cancellationPolicy?: string;
}) {
  const m = await getMessages();
  const hasPricing = pricing && pricing.subtotal > 0;
  const hasAdjustments = pricing && pricing.adjustments.length > 0;

  return (
    <aside className="panel storefront-summary-card">
      <div className="kicker">{m.checkoutSummary.kicker}</div>
      <h2 style={{ margin: "8px 0 10px" }}>
        {productName ?? m.checkoutSummary.defaultTitle}
      </h2>

      {hasPricing ? (
        <div className="list" style={{ marginTop: 16 }}>
          <div className="order-card">
            <div style={{ display: "grid", gap: 8 }}>
              {hasAdjustments && (
                <div className="order-row">
                  <span className="muted">{m.checkoutSummary.basePrice}</span>
                  <span>${pricing.basePrice.toFixed(2)}</span>
                </div>
              )}
              {hasAdjustments &&
                pricing.adjustments.map((adj) => (
                  <div className="order-row" key={adj.ruleName}>
                    <span className="muted" style={{ fontSize: 13 }}>
                      {adj.ruleName} ({adj.percentage > 0 ? "+" : ""}
                      {adj.percentage}%)
                    </span>
                    <span
                      style={{
                        fontSize: 13,
                        color: adj.amount >= 0 ? "inherit" : "var(--success)",
                      }}
                    >
                      {adj.amount >= 0 ? "+" : ""}${adj.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              <div className="order-row">
                <span className="muted">{hasAdjustments ? m.checkoutSummary.adjustedSubtotal : m.checkoutSummary.subtotal}</span>
                <span>${pricing.subtotal.toFixed(2)}</span>
              </div>
              <div className="order-row">
                <span className="muted">{m.checkoutSummary.deliveryFee}</span>
                <span>
                  {pricing.deliveryFee === null
                    ? m.checkoutSummary.deliveryTBD
                    : pricing.deliveryFee === 0
                      ? m.checkoutSummary.deliveryFree
                      : `$${pricing.deliveryFee.toFixed(2)}`}
                </span>
              </div>
              {pricing.total !== null && (
                <div
                  className="order-row"
                  style={{ borderTop: "1px solid var(--border)", paddingTop: 8 }}
                >
                  <strong>{m.checkoutSummary.total}</strong>
                  <strong>${pricing.total.toFixed(2)}</strong>
                </div>
              )}
              {pricing.deposit !== null && pricing.deposit > 0 && (
                <div className="order-row">
                  <span style={{ color: "var(--primary)", fontWeight: 600 }}>
                    {m.checkoutSummary.depositDue}
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
            ? m.checkoutSummary.enterZipMessage
            : m.checkoutSummary.selectProductMessage}
        </div>
      )}

      <div className="list" style={{ marginTop: 16 }}>
        <div className="order-card">
          <strong>{m.checkoutSummary.whatHappensNext}</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            {stripeEnabled
              ? m.checkoutSummary.nextStripeBody
              : m.checkoutSummary.nextNoStripeBody}
          </div>
        </div>
        <div className="order-card">
          <strong>{m.checkoutSummary.deliverySetup}</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            {m.checkoutSummary.deliverySetupBody}
          </div>
        </div>
        {cancellationPolicy && (
          <div className="order-card">
            <strong>{m.checkoutSummary.cancellationPolicy}</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              {cancellationPolicy}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 18 }}>
        <Link href="/inventory" className="secondary-btn">
          {m.checkoutSummary.backToCatalog}
        </Link>
      </div>
    </aside>
  );
}
