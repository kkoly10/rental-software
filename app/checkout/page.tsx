import { PublicHeader } from "@/components/layout/public-header";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}) {
  const { product } = await searchParams;

  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container two-col">
          <section className="panel">
            <div className="kicker">Checkout</div>
            <h1 style={{ margin: "6px 0 8px" }}>Complete your booking</h1>
            <div className="muted">
              Enter your event details and delivery address to create a booking request.
              A deposit is required to confirm your reservation.
            </div>

            <CheckoutForm productSlug={product} />
          </section>

          <aside className="panel">
            <div className="kicker">How it works</div>
            <div className="list" style={{ marginTop: 12 }}>
              <div className="order-card">
                <strong>1. Submit your booking</strong>
                <div className="muted">Fill out the form with your event and delivery details.</div>
              </div>
              <div className="order-card">
                <strong>2. Deposit hold</strong>
                <div className="muted">A ~30% deposit is required to lock your date.</div>
              </div>
              <div className="order-card">
                <strong>3. Confirmation</strong>
                <div className="muted">We confirm availability and send your rental agreement.</div>
              </div>
              <div className="order-card">
                <strong>4. Delivery day</strong>
                <div className="muted">Our crew delivers, sets up, and picks up after your event.</div>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
