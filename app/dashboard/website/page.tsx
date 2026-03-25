import { DashboardShell } from "@/components/layout/dashboard-shell";
import { WebsiteSettingsForm } from "@/components/settings/website-settings-form";
import { getOrgSettings } from "@/lib/data/settings";

export default async function WebsitePage() {
  const settings = await getOrgSettings();

  return (
    <DashboardShell
      title="Website"
      description="Manage homepage messaging, service area text, and public booking presentation."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Public site</div>
            <h2 style={{ margin: "6px 0 0" }}>Website controls</h2>
          </div>
        </div>

        <WebsiteSettingsForm
          defaults={{
            heroMessage: settings.heroMessage,
            serviceAreaText: settings.serviceAreaText,
            bookingMessage: settings.bookingMessage,
          }}
        />
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="section-header">
          <div>
            <div className="kicker">Coming soon</div>
            <h2 style={{ margin: "6px 0 0" }}>Advanced controls</h2>
          </div>
        </div>
        <div className="list">
          <div className="order-card">
            <strong>Featured inventory</strong>
            <div className="muted">Select which inflatables are highlighted on the public homepage.</div>
          </div>
          <div className="order-card">
            <strong>Category ordering</strong>
            <div className="muted">Control the display order of product categories on the catalog page.</div>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
