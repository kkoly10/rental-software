import { DashboardListLoading } from "@/components/dashboard/dashboard-list-loading";
import { getMessages } from "@/lib/i18n/server";

export default async function HelpCenterLoading() {
  const m = await getMessages();
  return (
    <DashboardListLoading
      title={m.dashboard.help.title}
      description={m.dashboard.help.description}
    />
  );
}
