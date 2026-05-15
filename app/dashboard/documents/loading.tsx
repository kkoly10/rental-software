import { DashboardListLoading } from "@/components/dashboard/dashboard-list-loading";
import { getMessages } from "@/lib/i18n/server";

export default async function DocumentsLoading() {
  const m = await getMessages();
  return (
    <DashboardListLoading
      title={m.dashboard.documents.title}
      description={m.dashboard.documents.description}
    />
  );
}
