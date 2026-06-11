import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SubscriptionStatusCard } from "@/components/settings/subscription-status-card";
import { StripeConnectCard } from "@/components/settings/stripe-connect-card";
import { PlanSelector } from "@/components/settings/plan-selector";
import { getSubscriptionInfo } from "@/lib/stripe/subscription";
import { getGuidanceState } from "@/lib/guidance/actions";
import { pageHelpMap } from "@/lib/help/page-help";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";
import { getMessages } from "@/lib/i18n/server";

export default async function BillingPage() {
  const [subscription, guidanceState, m] = await Promise.all([
    getSubscriptionInfo(),
    getGuidanceState(),
    getMessages(),
  ]);
  const helpConfig = pageHelpMap["/dashboard/settings"];

  return (
    <DashboardShell
      title={m.dashboard.billing.title}
      description={m.dashboard.billing.description}
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
          <StripeConnectCard />
          <div style={{ marginTop: 18 }}>
            <PlanSelector currentPlan={subscription.plan} interval="monthly" />
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.billing.kickerFaq}</div>
              <h2 style={{ margin: "6px 0 0" }}>{m.dashboard.billing.commonQuestions}</h2>
            </div>
          </div>

          <div className="list">
            {m.dashboard.billing.faqs.map((faq, idx) => (
              <article key={idx} className="order-card">
                <strong>{faq.q}</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  {faq.a}
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
