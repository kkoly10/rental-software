import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PricingRulesManager } from "@/components/pricing/pricing-rules-manager";
import { PricingPreview } from "@/components/pricing/pricing-preview";
import { getPricingRules } from "@/lib/data/pricing-rules";

export default async function PricingPage() {
  const rules = await getPricingRules();

  return (
    <DashboardShell
      title="Pricing Rules"
      description="Configure dynamic and seasonal pricing adjustments for your rentals."
    >
      <div className="dashboard-grid" style={{ marginTop: 18 }}>
        <PricingRulesManager initialRules={rules} />
        <aside>
          <PricingPreview rules={rules} />
        </aside>
      </div>
    </DashboardShell>
  );
}
