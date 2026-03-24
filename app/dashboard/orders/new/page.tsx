import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function NewOrderPage() {
  return (
    <DashboardShell
      title="Create Order"
      description="Create a new manual booking, quote, or internal reservation."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Booking creation</div>
            <h2 style={{ margin: "6px 0 0" }}>New order workflow</h2>
          </div>
        </div>
        <div className="list">
          <div className="order-card">
            <strong>Customer</strong>
            <div className="muted">Select existing customer or create a new one.</div>
          </div>
          <div className="order-card">
            <strong>Rental items</strong>
            <div className="muted">Choose inflatables, add-ons, quantities, and delivery rules.</div>
          </div>
          <div className="order-card">
            <strong>Event details</strong>
            <div className="muted">Event date, address, setup notes, and delivery window.</div>
          </div>
          <div className="order-card">
            <strong>Pricing</strong>
            <div className="muted">Deposit amount, fees, discounts, taxes, and balance due.</div>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
