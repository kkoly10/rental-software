import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PricingRulesManager } from "@/components/pricing/pricing-rules-manager";
import { PricingPreview } from "@/components/pricing/pricing-preview";
import { getPricingRules } from "@/lib/data/pricing-rules";
import { getMessages } from "@/lib/i18n/server";

export default async function PricingPage() {
  const [rules, m] = await Promise.all([getPricingRules(), getMessages()]);

  return (
    <DashboardShell
      title={m.dashboard.pricingRules.title}
      description={m.dashboard.pricingRules.description}
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
