import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getDashboardSummary } from "@/lib/data/dashboard";
import { getGuidanceSnapshot } from "@/lib/data/guidance-snapshot";
import { getGuidanceState } from "@/lib/guidance/actions";
import { computeChecklist } from "@/lib/guidance/checklist";
import { detectNewMilestone } from "@/lib/guidance/milestones";
import { pageHelpMap } from "@/lib/help/page-help";
import { DashboardGuidance } from "@/components/guidance/dashboard-guidance";
import { SetupChecklistCard } from "@/components/guidance/setup-checklist-card";
import { ContextHelpBanner } from "@/components/guidance/context-help-banner";
import { MilestoneCelebration } from "@/components/dashboard/milestone-celebration";
import { SetupProgressBar } from "@/components/dashboard/setup-progress-bar";
import { DashboardGreeting } from "@/components/dashboard/dashboard-greeting";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getNotifications } from "@/lib/data/notifications";
import { getSubscriptionStatus } from "@/lib/stripe/get-subscription-status";
import { getDomainSettings } from "@/lib/data/domain-settings";
import { buildStorefrontUrl } from "@/lib/storefront/url";
import { headers } from "next/headers";
import { getTranslator } from "@/lib/i18n/server";

export default async function DashboardPage() {
  const [summary, snapshot, guidanceState, settings, notifications, subscriptionStatus, domainSettings, headersList, { messages: m, t }] =
    await Promise.all([
      getDashboardSummary(),
      getGuidanceSnapshot(),
      getGuidanceState(),
      getOrganizationSettings(),
      getNotifications(),
      getSubscriptionStatus(),
      getDomainSettings(),
      headers(),
      getTranslator(),
    ]);

  const checklist = computeChecklist(snapshot);
  const helpConfig = pageHelpMap["/dashboard"];
  const requestHost = headersList.get("host") ?? undefined;
  const storefrontUrl = buildStorefrontUrl(domainSettings, requestHost);
  const milestone = detectNewMilestone(
    snapshot,
    guidanceState.dismissedMilestones ?? []
  );

  return (
    <DashboardShell
      title={m.dashboard.overview.title}
      description={m.dashboard.overview.description}
      notifications={notifications}
      subscriptionStatus={subscriptionStatus}
      hideHeader
    >
      <DashboardGuidance
        guidanceState={guidanceState}
        businessName={settings.businessName}
      />

      {helpConfig && (
        <ContextHelpBanner
          config={helpConfig}
          dismissed={guidanceState.dismissedHelp[helpConfig.key] ?? false}
        />
      )}

      <DashboardGreeting businessName={settings.businessName} />

      {!guidanceState.dismissedChecklist && (
        <div style={{ marginBottom: 16 }}>
          <SetupProgressBar
            completed={checklist.completed}
            total={checklist.total}
            allDone={checklist.completed === checklist.total}
          />
        </div>
      )}

      <div data-tour="dashboard-overview">
        <div className="stats-row">
          <StatCard
            label={m.dashboard.overview.stats.todayBookings}
            value={String(summary.todayBookings)}
            meta={m.dashboard.overview.stats.todayBookingsMeta}
          />
          <StatCard
            label={m.dashboard.overview.stats.upcomingDeliveries}
            value={String(summary.upcomingDeliveries)}
            meta={m.dashboard.overview.stats.upcomingDeliveriesMeta}
          />
          <StatCard
            label={m.dashboard.overview.stats.activeProducts}
            value={String(summary.activeProducts)}
            meta={m.dashboard.overview.stats.activeProductsMeta}
          />
          <StatCard
            label={m.dashboard.overview.stats.paymentItems}
            value={String(summary.recentPaymentsCount)}
            meta={m.dashboard.overview.stats.paymentItemsMeta}
          />
        </div>
      </div>

      {!guidanceState.dismissedChecklist && (
        <div className="stack-gap-md">
          <SetupChecklistCard
            items={checklist.items.map((i) => ({
              id: i.id,
              title: i.title,
              description: i.description,
              href: i.href,
              order: i.order,
              completed: i.completed,
            }))}
            completed={checklist.completed}
            total={checklist.total}
          />
        </div>
      )}

      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.overview.sections.today}</div>
              <h2 className="page-title-sm">{m.dashboard.overview.sections.recentOrders}</h2>
            </div>
            <Link href="/dashboard/orders" className="ghost-btn">
              {m.dashboard.overview.sections.viewAll}
            </Link>
          </div>

          {summary.recentOrders.length === 0 ? (
            <EmptyState
              icon="orders"
              title={m.dashboard.overview.empty.noOrdersTitle}
              description={m.dashboard.overview.empty.noOrdersDescription}
              actionLabel={m.dashboard.overview.empty.createFirst}
              actionHref="/dashboard/orders/new"
            />
          ) : (
            <div className="list">
              {summary.recentOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/dashboard/orders/${order.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div className="order-card">
                    <div className="order-row">
                      <strong>{order.customer}</strong>
                      <StatusBadge
                        label={order.status}
                        tone={order.tone as "default" | "success" | "warning"}
                      />
                    </div>
                    <div className="muted">
                      {order.item} · {order.date} · {order.total}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.dashboard.overview.sections.quickActions}</div>
              <h2 className="page-title-sm">{m.dashboard.overview.sections.getThingsDone}</h2>
            </div>
          </div>

          <div className="list">
            <Link
              href="/dashboard/orders/new"
              className="order-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <strong>{m.dashboard.overview.quickLinks.newOrder}</strong>
              <div className="muted">
                {m.dashboard.overview.quickLinks.newOrderDesc}
              </div>
            </Link>
            <Link
              href="/dashboard/products/new"
              className="order-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <strong>{m.dashboard.overview.quickLinks.addProduct}</strong>
              <div className="muted">
                {m.dashboard.overview.quickLinks.addProductDesc}
              </div>
            </Link>
            <Link
              href="/dashboard/deliveries"
              className="order-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <strong>{m.dashboard.overview.quickLinks.deliveryBoard}</strong>
              <div className="muted">{m.dashboard.overview.quickLinks.deliveryBoardDesc}</div>
            </Link>
            <Link
              href="/dashboard/analytics"
              className="order-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <strong>{m.dashboard.overview.quickLinks.analytics}</strong>
              <div className="muted">
                {m.dashboard.overview.quickLinks.analyticsDesc}
              </div>
            </Link>
            <Link
              href="/dashboard/help"
              className="order-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <strong>{m.dashboard.overview.quickLinks.helpCenter}</strong>
              <div className="muted">{m.dashboard.overview.quickLinks.helpCenterDesc}</div>
            </Link>
            {storefrontUrl ? (
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="order-card"
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <strong>{m.dashboard.overview.quickLinks.viewStorefront} &#8599;</strong>
                <div className="muted">{m.dashboard.overview.quickLinks.viewStorefrontDesc}</div>
              </a>
            ) : (
              <Link href="/dashboard/website" className="order-card" style={{ textDecoration: "none", color: "inherit" }}>
                <strong>{m.dashboard.overview.quickLinks.setupStorefront}</strong>
                <div className="muted">{m.dashboard.overview.quickLinks.setupStorefrontDesc}</div>
              </Link>
            )}
          </div>

          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              background: "var(--surface-muted)",
              fontSize: 13,
              color: "var(--text-soft)",
              textAlign: "center",
            }}
          >
            {t(m.dashboard.overview.searchHint, { key: "Cmd+K" })}
          </div>
        </aside>
      </div>

      {milestone && <MilestoneCelebration milestoneKey={milestone} />}
    </DashboardShell>
  );
}
