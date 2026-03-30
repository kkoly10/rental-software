import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SubscriptionStatusCard } from "@/components/settings/subscription-status-card";
import { PlanSelector } from "@/components/settings/plan-selector";
import { getSubscriptionInfo } from "@/lib/stripe/subscription";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";

export default async function BillingPage() {
  const [subscription, guidanceState] = await Promise.all([
    getSubscriptionInfo(),
    getGuidanceState(),
  ]);
  const helpConfig = pageHelpMap["/dashboard/settings"];

  return (
    <DashboardShell
      title="Billing"
      description="Manage your subscription plan and payment method."
    >
      {helpConfig && (
        <ContextHelpBanner
          config={helpConfig}
          dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false}
        />
      )}

      <div className="dashboard-grid">
        <section>
          <SubscriptionStatusCard subscription={subscription} />
          <div style={{ marginTop: 18 }}>
            <PlanSelector currentPlan={subscription.plan} interval="monthly" />
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Billing FAQ</div>
              <h2 style={{ margin: "6px 0 0" }}>Common questions</h2>
            </div>
          </div>

          <div className="list">
            <article className="order-card">
              <strong>Can I switch plans?</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Yes! Upgrade or downgrade anytime. Changes are prorated automatically.
              </div>
            </article>

            <article className="order-card">
              <strong>What happens when I cancel?</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                You keep access until the end of your billing period. Your data is
                preserved for 90 days.
              </div>
            </article>

            <article className="order-card">
              <strong>Is there a free trial?</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Every new account gets a 14-day free trial on any plan. No credit
                card required to start.
              </div>
            </article>

            <article className="order-card">
              <strong>What payment methods do you accept?</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                All major credit cards via Stripe. We also accept ACH bank transfers
                on annual plans.
              </div>
            </article>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
