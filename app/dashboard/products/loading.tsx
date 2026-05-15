import { DashboardListLoading } from "@/components/dashboard/dashboard-list-loading";
import { getMessages } from "@/lib/i18n/server";

export default async function ProductsLoading() {
  const m = await getMessages();
  return (
    <DashboardListLoading
      title={m.dashboard.products.title}
      description={m.dashboard.products.description}
      buttonLabel={m.nav.catalog}
      showButton
    />
  );
}
