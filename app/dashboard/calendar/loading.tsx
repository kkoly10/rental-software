import { DashboardListLoading } from "@/components/dashboard/dashboard-list-loading";
import { getMessages } from "@/lib/i18n/server";

export default async function CalendarLoading() {
  const m = await getMessages();
  return (
    <DashboardListLoading
      title={m.dashboard.calendar.title}
      description={m.dashboard.calendar.description}
      buttonLabel={m.dashboard.calendar.newBooking}
      showButton
    />
  );
}
