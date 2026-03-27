import { DashboardListLoading } from "@/components/dashboard/dashboard-list-loading";

export default function OrdersLoading() {
  return (
    <DashboardListLoading
      title="Orders"
      description="Loading inquiries, bookings, and payment readiness."
      buttonLabel="New order"
      showButton
    />
  );
}
