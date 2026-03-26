import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { HelpSearch } from "@/components/help/help-search";
import { HelpArticleList } from "@/components/help/help-article-list";
import { getGuidanceState } from "@/lib/guidance/actions";

export default async function HelpCenterPage() {
  const guidanceState = await getGuidanceState();

  return (
    <DashboardShell
      title="Help Center"
      description="Guides, articles, and answers for running your rental business."
    >
      <div className="dashboard-grid">
        <div>
          <HelpSearch />
          <HelpArticleList />
        </div>

        <aside className="panel" style={{ alignSelf: "start" }}>
          <div className="kicker">Quick links</div>
          <h3 style={{ margin: "6px 0 12px" }}>Need help?</h3>
          <div className="list">
            <Link href="/dashboard/help/first-steps" className="order-card" style={{ textDecoration: "none", color: "inherit" }}>
              <strong style={{ fontSize: 14 }}>First steps guide</strong>
              <div className="muted" style={{ fontSize: 13 }}>Start here if you&rsquo;re new</div>
            </Link>
            <Link href="/dashboard/help/getting-more-help" className="order-card" style={{ textDecoration: "none", color: "inherit" }}>
              <strong style={{ fontSize: 14 }}>Getting more help</strong>
              <div className="muted" style={{ fontSize: 13 }}>All support options</div>
            </Link>
            {!guidanceState.hasCompletedTour && (
              <Link href="/dashboard" className="order-card" style={{ textDecoration: "none", color: "inherit" }}>
                <strong style={{ fontSize: 14 }}>Take the guided tour</strong>
                <div className="muted" style={{ fontSize: 13 }}>2-minute dashboard walkthrough</div>
              </Link>
            )}
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
