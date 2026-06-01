import { getTranslator } from "@/lib/i18n/server";

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

function pickGreetingKey(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

export async function DashboardGreeting({
  businessName,
}: {
  businessName: string;
}) {
  const { messages: m, t } = await getTranslator();
  const slot = pickGreetingKey();
  const greetingTemplate = m.dashboard.overview.greeting[slot];
  // Fall back to the business name if no value is set yet — the
  // existing organization-settings fallback returns "" when the
  // org is unclaimed, and a stray comma in the greeting reads
  // weird ("Good morning, .").
  const name = businessName?.trim() ? businessName.trim() : m.dashboard.overview.greeting.fallbackName;

  return (
    <div className="dashboard-greeting">
      <div className="dashboard-greeting-text">
        {/* h1 — this is the page's top-level heading on /dashboard
            (the DashboardShell title is hidden via the hideHeader
            prop), so screen readers and SEO expect h1, not h2. */}
        <h1 className="dashboard-greeting-headline">
          {t(greetingTemplate, { name })}
        </h1>
        <p className="dashboard-greeting-tagline">
          {m.dashboard.overview.greeting.tagline}
        </p>
      </div>
      <a
        href="/dashboard/orders/new"
        className="primary-btn dashboard-greeting-cta"
      >
        + {m.dashboard.overview.quickLinks.newOrder}
      </a>
    </div>
  );
}
