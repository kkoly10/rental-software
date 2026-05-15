import { DashboardShell } from "@/components/layout/dashboard-shell";
import { NewOrderForm } from "@/components/orders/new-order-form";
import { getOrderFormOptions } from "@/lib/data/order-form-options";
import { getMessages } from "@/lib/i18n/server";

export default async function NewOrderPage() {
  const [{ products, serviceAreas }, m] = await Promise.all([
    getOrderFormOptions(),
    getMessages(),
  ]);

  return (
    <DashboardShell
      title={m.dashboard.newOrder.title}
      description={m.dashboard.newOrder.description}
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Booking creation</div>
            <h2 style={{ margin: "6px 0 0" }}>New order</h2>
          </div>
        </div>
        <NewOrderForm products={products} serviceAreas={serviceAreas} />
      </section>
    </DashboardShell>
  );
}