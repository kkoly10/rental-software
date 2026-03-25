import { PublicHeader } from "@/components/layout/public-header";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export default function CheckoutPage() {
  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container two-col">
          <section className="panel">
            <div className="kicker">Checkout</div>
            <h1 style={{ margin: "6px 0 8px" }}>Complete your booking</h1>
            <div className="muted">
              Enter your delivery details to create a live order record.
            </div>

            <CheckoutForm />
          </section>

          <aside className="panel">
            <div className="kicker">Order summary</div>
            <div className="list" style={{ marginTop: 12 }}>
              <div className="order-card">Mega Splash Water Slide</div>
              <div className="order-card">Delivery to 22554</div>
              <div className="order-card">Deposit due today: $75</div>
              <div className="order-card">
                Remaining balance collected later
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}