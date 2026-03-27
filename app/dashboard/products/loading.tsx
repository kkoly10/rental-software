import { DashboardListLoading } from "@/components/dashboard/dashboard-list-loading";

export default function ProductsLoading() {
  return (
    <DashboardListLoading
      title="Products"
      description="Loading catalog data and pricing details."
      buttonLabel="Catalog"
      showButton
    />
  );
}
