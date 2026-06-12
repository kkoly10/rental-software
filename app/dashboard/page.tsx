import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { getDashboardSummary } from "@/lib/data/dashboard";
import { getGuidanceSnapshot } from "@/lib/data/guidance-snapshot";
import { StorefrontReadinessBanner } from "@/components/guidance/storefront-readiness-banner";
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
import { AiCopilotCard } from "@/components/dashboard/ai-copilot-card";
import { ActivityTimeline } from "@/components/dashboard/activity-timeline";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getNotifications } from "@/lib/data/notifications";
import { getSubscriptionStatus } from "@/lib/stripe/get-subscription-status";
import { getDomainSettings } from "@/lib/data/domain-settings";
import { buildStorefrontUrl } from "@/lib/storefront/url";
import { headers } from "next/headers";
import { getTranslator } from "@/lib/i18n/server";

// Marketplace mode (Amazon model): marketplace-only sellers land on
// their marketplace-branded Seller Hub, not the operator overview —
// until they explicitly unlock the full toolkit (/dashboard/unlock).
// Returns true when the request should bounce to /market/hub. Runs
// inside the page's parallel fetch batch — as a serial pre-block it
// was adding two extra round trips before any other data started.
async function shouldRedirectToMarketHub(): Promise<boolean> {
  const { hasSupabaseEnv } = await import("@/lib/env");
  if (!hasSupabaseEnv()) return false;
  const { getOrgContext } = await import("@/lib/auth/org-context");
  const ctx = await getOrgContext();
  if (ctx?.businessType !== "marketplace_seller") return false;
  const { createSupabaseServerClient } = await import("@/lib/supabase/server");
  const supabase = await createSupabaseServerClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("settings")
    .eq("id", ctx.organizationId)
    .maybeSingle();
  return !Boolean(
    (org?.settings as Record<string, unknown> | null)?.full_toolkit,
  );
}

export default async function DashboardPage() {
  const [marketHubRedirect, summary, snapshot, guidanceState, settings, notifications, subscriptionStatus, domainSettings, headersList, { messages: m, t }] =
    await Promise.all([
      shouldRedirectToMarketHub(),
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

  if (marketHubRedirect) {
    const { redirect } = await import("next/navigation");
    redirect("/market/hub");
  }

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

      <StorefrontReadinessBanner
        productsCount={snapshot.productsCount}
        serviceAreasCount={snapshot.serviceAreasCount}
      />

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
            accent="var(--secondary)"
            spark={summary.bookingsSeries}
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1.5l6.5 3.5v8L9 16.5 2.5 13V5L9 1.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M2.5 5L9 8.5 15.5 5M9 8.5v8" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
            }
          />
          <StatCard
            label={m.dashboard.overview.stats.upcomingDeliveries}
            value={String(summary.upcomingDeliveries)}
            meta={m.dashboard.overview.stats.upcomingDeliveriesMeta}
            accent="var(--info)"
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M1.5 4.5h8v7h-8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M9.5 7h3l2 2.5v2h-5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="4.5" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5"/></svg>
            }
          />
          <StatCard
            label={m.dashboard.overview.stats.activeProducts}
            value={String(summary.activeProducts)}
            meta={m.dashboard.overview.stats.activeProductsMeta}
            accent="var(--accent)"
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="10.5" y="2" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="10.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="10.5" y="10.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>
            }
          />
          <StatCard
            label={m.dashboard.overview.stats.paymentItems}
            value={String(summary.recentPaymentsCount)}
            meta={m.dashboard.overview.stats.paymentItemsMeta}
            accent="var(--success)"
            spark={summary.paymentsSeries}
            icon={
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1.5v15M12.5 4.5H7.2a2.2 2.2 0 0 0 0 4.4h3.6a2.2 2.2 0 0 1 0 4.4H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
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
              <h2 className="page-title-sm">{m.dashboard.overview.sections.recentActivity}</h2>
            </div>
            <Link href="/dashboard/orders" className="ghost-btn">
              {m.dashboard.overview.sections.viewAll}
            </Link>
          </div>

          {notifications.length === 0 ? (
            <EmptyState
              icon="orders"
              title={m.dashboard.overview.empty.noActivityTitle}
              description={m.dashboard.overview.empty.noActivityDescription}
              actionLabel={m.dashboard.overview.empty.createFirst}
              actionHref="/dashboard/orders/new"
            />
          ) : (
            <ActivityTimeline items={notifications.slice(0, 6)} />
          )}
        </section>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <AiCopilotCard stepsLeft={Math.max(0, checklist.total - checklist.completed)} />
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
      </div>

      {milestone && <MilestoneCelebration milestoneKey={milestone} />}
    </DashboardShell>
  );
}
