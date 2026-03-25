import { DashboardShell } from "@/components/layout/dashboard-shell";
import { NewOrderForm } from "@/components/orders/new-order-form";

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
            <h2 style={{ margin: "6px 0 0" }}>New order</h2>
          </div>
        </div>
        <NewOrderForm />
      </section>
    </DashboardShell>
  );
}
