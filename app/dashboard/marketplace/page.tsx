import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SellerHubPanels } from "@/components/market/seller-hub-panels";

export const dynamic = "force-dynamic";

/**
 * Seller Hub — operator-dashboard door (spec §32). The marketplace-
 * branded door at /market/hub renders the same SellerHubPanels; this
 * tab stays for SaaS operators who live in the dashboard.
 */
export default async function MarketplaceSellerHubPage() {
  return (
    <DashboardShell
      title="Marketplace"
      description="Your store page and listings on the Korent marketplace. List free — an 8% operator fee applies only when you get booked."
    >
      <SellerHubPanels />
    </DashboardShell>
  );
}
