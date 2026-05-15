import { DashboardListLoading } from "@/components/dashboard/dashboard-list-loading";
import { getMessages } from "@/lib/i18n/server";

export default async function PaymentsLoading() {
  const m = await getMessages();
  return (
    <DashboardListLoading
      title={m.dashboard.payments.title}
      description={m.dashboard.payments.description}
    />
  );
}
