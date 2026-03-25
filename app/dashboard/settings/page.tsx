import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getOrganizationSettings } from "@/lib/data/organization-settings";

export default async function SettingsPage() {
  const settings = await getOrganizationSettings();

  return (
    <DashboardShell
      title="Settings"
      description="Manage business preferences, support details, and booking defaults."
    >
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Business settings</div>
              <h2 style={{ margin: "6px 0 0" }}>Workspace configuration</h2>
            </div>
          </div>

          <div className="list">
            <article className="order-card">
              <strong>Business profile</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {settings.businessName}
              </div>
              <div className="muted">{settings.supportEmail}</div>
              <div className="muted">{settings.phone}</div>
            </article>

            <article className="order-card">
              <strong>Regional defaults</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Timezone: {settings.timezone}
              </div>
              <div className="muted">Currency: {settings.currency}</div>
              <div className="muted">
                Service areas: {settings.serviceAreaLabel}
              </div>
            </article>

            <article className="order-card">
              <strong>Booking defaults</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {settings.depositPolicy}
              </div>
              <div className="muted">{settings.publicBookingLabel}</div>
            </article>
          </div>
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Storefront snapshot</div>
              <h2 style={{ margin: "6px 0 0" }}>Public site messaging</h2>
            </div>
          </div>

          <div className="list">
            <article className="order-card">
              <strong>Homepage message</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {settings.websiteMessage}
              </div>
            </article>

            <article className="order-card">
              <strong>Featured inventory</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {settings.featuredInventoryLabel}
              </div>
            </article>

            <article className="order-card">
              <strong>Operator note</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                This page is now reading real organization-aware data with
                fallback values when live data is unavailable.
              </div>
            </article>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}