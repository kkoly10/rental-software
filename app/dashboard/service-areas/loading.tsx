import { DashboardListLoading } from "@/components/dashboard/dashboard-list-loading";
import { getMessages } from "@/lib/i18n/server";

export default async function ServiceAreasLoading() {
  const m = await getMessages();
  return (
    <DashboardListLoading
      title={m.dashboard.serviceAreas.title}
      description={m.dashboard.serviceAreas.description}
    />
  );
}
