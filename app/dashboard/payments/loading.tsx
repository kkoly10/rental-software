import { DashboardListLoading } from "@/components/dashboard/dashboard-list-loading";

export default function PaymentsLoading() {
  return (
    <DashboardListLoading
      title="Payments"
      description="Loading deposits, balances, and payment records."
    />
  );
}
