import { getTranslator } from "@/lib/i18n/server";
import { DashboardGreetingHeadline } from "./dashboard-greeting-headline";

/**
 * Personalised hello row above the stats grid.  Mirrors the
 * mockup's "Good morning, Bounce Kingdom ☀️" header without
 * overlapping the DashboardShell title (which other dashboard
 * pages share — we don't want to lose that affordance).
 *
 * Re-uses the existing "+ New Order" link rather than introducing
 * a second CTA: the Quick Actions panel keeps its full menu of
 * deep links; this is just a fast-path for the most common
 * action on the most-visited page.
 */

export async function DashboardGreeting({
  businessName,
}: {
  businessName?: string | null;
}) {
  const { messages: m } = await getTranslator();
  // Fall back to the i18n placeholder when no value is set — a stray
  // comma in the greeting ("Good morning, .") reads weird and we
  // can't trust upstream callers to always pass a non-empty string.
  const name = businessName?.trim() ? businessName.trim() : m.dashboard.overview.greeting.fallbackName;

  return (
    <div className="dashboard-greeting">
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
  );
}
