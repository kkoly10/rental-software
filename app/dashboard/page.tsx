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
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getNotifications } from "@/lib/data/notifications";
import { getSubscriptionStatus } from "@/lib/stripe/get-subscription-status";

export default async function DashboardPage() {
  const [summary, snapshot, guidanceState, settings, notifications, subscriptionStatus] =
    await Promise.all([
      getDashboardSummary(),
      getGuidanceSnapshot(),
      getGuidanceState(),
      getOrganizationSettings(),
      getNotifications(),
      getSubscriptionStatus(),
    ]);

  const checklist = computeChecklist(snapshot);
  const helpConfig = pageHelpMap["/dashboard"];
  const milestone = detectNewMilestone(
    snapshot,
    guidanceState.dismissedMilestones ?? []
  );

  return (
    <DashboardShell
      title="Operator Dashboard"
      description="Daily overview for bookings, deliveries, payments, and tasks."
      notifications={notifications}
      subscriptionStatus={subscriptionStatus}
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
            label="Today's bookings"
            value={String(summary.todayBookings)}
            meta="Live order pipeline"
          />
          <StatCard
            label="Upcoming deliveries"
            value={String(summary.upcomingDeliveries)}
            meta="Route-ready bookings"
          />
          <StatCard
            label="Active products"
            value={String(summary.activeProducts)}
            meta="Catalog items online"
          />
          <StatCard
            label="Payment items"
            value={String(summary.paymentItems)}
            meta="Recent money activity"
          />
        </div>
      </div>

      {!guidanceState.dismissedChecklist && (
        <div style={{ marginTop: 18 }}>
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
              <div className="kicker">Today</div>
              <h2 style={{ margin: "6px 0 0" }}>Recent orders</h2>
            </div>
            <Link href="/dashboard/orders" className="ghost-btn">
              View all
            </Link>
          </div>

          {summary.recentOrders.length === 0 ? (
            <EmptyState
              icon="orders"
              title="No orders yet"
              description="When customers book through your storefront or you create a manual order, they'll appear here."
              actionLabel="Create first order"
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
              <div className="kicker">Quick actions</div>
              <h2 style={{ margin: "6px 0 0" }}>Get things done</h2>
            </div>
          </div>

          <div className="list">
            <Link
              href="/dashboard/orders/new"
              className="order-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <strong>Create new order</strong>
              <div className="muted">
                Manual booking, quote, or reservation
              </div>
            </Link>
            <Link
              href="/dashboard/products/new"
              className="order-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <strong>Add product</strong>
              <div className="muted">
                New inflatable for the public catalog
              </div>
            </Link>
            <Link
              href="/dashboard/deliveries"
              className="order-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <strong>Delivery board</strong>
              <div className="muted">Route management and crew dispatch</div>
            </Link>
            <Link
              href="/dashboard/analytics"
              className="order-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <strong>Analytics</strong>
              <div className="muted">
                Revenue, orders, and product performance
              </div>
            </Link>
            <Link
              href="/dashboard/help"
              className="order-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <strong>Help Center</strong>
              <div className="muted">Guides and articles for every feature</div>
            </Link>
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="order-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <strong>View my storefront &#8599;</strong>
              <div className="muted">See what customers see when they visit your site</div>
            </a>
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
            Press{" "}
            <kbd
              style={{
                padding: "2px 6px",
                borderRadius: 5,
                background: "white",
                border: "1px solid var(--border)",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              Cmd+K
            </kbd>{" "}
            to search anything
          </div>
        </aside>
      </div>

      {milestone && <MilestoneCelebration milestoneKey={milestone} />}
    </DashboardShell>
  );
}
