import { DashboardShell } from "@/components/layout/dashboard-shell";
import { NewOrderForm } from "@/components/orders/new-order-form";
import { getOrderFormOptions } from "@/lib/data/order-form-options";
import { getMessages } from "@/lib/i18n/server";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ products, serviceAreas }, m, params] = await Promise.all([
    getOrderFormOptions(),
    getMessages(),
    searchParams,
  ]);

  // Deep-link prefill: /dashboard/orders/new?event_date=YYYY-MM-DD
  // Used by the diagnostic empty state on the route detail page so the
  // operator lands on the form with the right date already filled in.
  const rawDate = params.event_date;
  const initialEventDate =
    typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
      ? rawDate
      : undefined;

  return (
    <DashboardShell
      title={m.dashboard.newOrder.title}
      description={m.dashboard.newOrder.description}
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">{m.dashboard.orders.newOrderKicker}</div>
            <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.orders.newOrderSectionTitle}</h2>
          </div>
        </div>
        <NewOrderForm
          products={products}
          serviceAreas={serviceAreas}
          initialEventDate={initialEventDate}
        />
      </section>
    </DashboardShell>
  );
}
