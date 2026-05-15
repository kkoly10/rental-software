import { DashboardListLoading } from "@/components/dashboard/dashboard-list-loading";
import { getMessages } from "@/lib/i18n/server";

export default async function OrdersLoading() {
  const m = await getMessages();
  return (
    <DashboardListLoading
      title={m.dashboard.orders.title}
      description={m.dashboard.orders.description}
      buttonLabel={m.dashboard.orders.newOrder}
      showButton
    />
  );
}
