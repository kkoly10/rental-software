import { DashboardListLoading } from "@/components/dashboard/dashboard-list-loading";

export default function CalendarLoading() {
  return (
    <DashboardListLoading
      title="Calendar"
      description="Loading bookings, upcoming events, and schedule data."
      buttonLabel="New booking"
      showButton
    />
  );
}
