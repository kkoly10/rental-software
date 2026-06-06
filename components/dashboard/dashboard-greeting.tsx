import { getTranslator } from "@/lib/i18n/server";
import { DashboardGreetingHeadline } from "./dashboard-greeting-headline";

/**
 * Carnival v2 command-center header (Patch 3). Tinted hero band with a
 * workspace eyebrow, the personalised greeting, a tagline, and the fast-path
 * "+ New order" CTA — matching the dashboard mockup.
 */

export async function DashboardGreeting({
  businessName,
}: {
  businessName?: string | null;
}) {
  const { messages: m } = await getTranslator();
  const name = businessName?.trim() ? businessName.trim() : m.dashboard.overview.greeting.fallbackName;
  const eyebrow = businessName?.trim()
    ? `${m.dashboard.overview.greeting.workspaceEyebrow} · ${businessName.trim()}`
    : m.dashboard.overview.greeting.workspaceEyebrow;

  return (
    <div className="page-hero">
      <div className="eyebrow eyebrow--accent" style={{ marginBottom: 8 }}>{eyebrow}</div>
      <div className="page-hero__row">
        <div className="dashboard-greeting-text">
          <DashboardGreetingHeadline
            name={name}
            templates={{
              morning: m.dashboard.overview.greeting.morning,
              afternoon: m.dashboard.overview.greeting.afternoon,
              evening: m.dashboard.overview.greeting.evening,
            }}
          />
          <p className="dashboard-greeting-tagline">
            {m.dashboard.overview.greeting.tagline}
          </p>
        </div>
        <a
          href="/dashboard/orders/new"
          className="primary-btn dashboard-greeting-cta"
        >
          {m.dashboard.overview.quickLinks.newOrderCta}
        </a>
      </div>
    </div>
  );
}
