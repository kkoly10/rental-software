import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { CheckoutSummaryCard } from "@/components/checkout/checkout-summary-card";

function formatProductName(value?: string) {
  if (!value) return undefined;
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; date?: string; zip?: string }>;
}) {
  const { product, date, zip } = await searchParams;
  const productName = formatProductName(product);

  return (
    <>
      <PublicHeader />

      <main className="page">
        <div className="container">
          <div className="storefront-context-pills" style={{ marginBottom: 18 }}>
            {productName ? (
              <span className="storefront-context-pill">Rental: {productName}</span>
            ) : null}
            {date ? <span className="storefront-context-pill">Date: {date}</span> : null}
            {zip ? <span className="storefront-context-pill">ZIP: {zip}</span> : null}
          </div>

          <div className="storefront-checkout-shell">
            <section className="panel">
              <div className="kicker">Checkout</div>
              <h1 style={{ margin: "8px 0 10px" }}>Complete your booking request</h1>
              <div className="muted">
                Enter your event and delivery details to reserve your inflatable.
                We will confirm availability, setup timing, and agreement details
                after submission.
              </div>

              <CheckoutForm
                productSlug={product}
                initialDate={date}
                initialZip={zip}
              />
            </section>

            <CheckoutSummaryCard productName={productName} />
          </div>
        </div>
      </main>

      <PublicFooter />
    </>
  );
}
