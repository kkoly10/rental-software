import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function WebsitePage() {
  return (
    <DashboardShell
      title="Website"
      description="Manage homepage messaging, featured products, and public booking presentation."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Public site</div>
            <h2 style={{ margin: "6px 0 0" }}>Website controls</h2>
          </div>
        </div>
        <div className="list">
          <div className="order-card">
            <strong>Homepage content</strong>
            <div className="muted">Hero message, trust badges, service area copy, and featured sections.</div>
          </div>
          <div className="order-card">
            <strong>Featured inventory</strong>
            <div className="muted">Select which inflatables are highlighted on the public homepage.</div>
          </div>
          <div className="order-card">
            <strong>Booking presentation</strong>
            <div className="muted">Category ordering, product visibility, and public catalog defaults.</div>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
