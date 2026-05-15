import { DashboardListLoading } from "@/components/dashboard/dashboard-list-loading";
import { getMessages } from "@/lib/i18n/server";

export default async function MaintenanceLoading() {
  const m = await getMessages();
  return (
    <DashboardListLoading
      title={m.dashboard.maintenance.title}
      description={m.dashboard.maintenance.description}
    />
  );
}
