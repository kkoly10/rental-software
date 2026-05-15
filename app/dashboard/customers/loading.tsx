import { DashboardListLoading } from "@/components/dashboard/dashboard-list-loading";
import { getMessages } from "@/lib/i18n/server";

export default async function CustomersLoading() {
  const m = await getMessages();
  return (
    <DashboardListLoading
      title={m.dashboard.customers.title}
      description={m.dashboard.customers.description}
    />
  );
}
