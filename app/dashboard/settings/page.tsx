import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BusinessProfileForm } from "@/components/settings/business-profile-form";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { getOrgSettings } from "@/lib/data/settings";

export default async function SettingsPage() {
  const [orgSettings, editableSettings] = await Promise.all([
    getOrganizationSettings(),
    getOrgSettings(),
  ]);

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
              <h2 style={{ margin: "6px 0 0" }}>Business profile</h2>
            </div>
          </div>

          <BusinessProfileForm
            defaults={{
              name: editableSettings.name || orgSettings.businessName,
              supportEmail: editableSettings.supportEmail || orgSettings.supportEmail,
              phone: editableSettings.phone || orgSettings.phone,
              timezone: editableSettings.timezone || orgSettings.timezone,
            }}
          />
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Current snapshot</div>
              <h2 style={{ margin: "6px 0 0" }}>Active configuration</h2>
            </div>
          </div>

          <div className="list">
            <article className="order-card">
              <strong>Regional defaults</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                Timezone: {orgSettings.timezone}
              </div>
              <div className="muted">Currency: {orgSettings.currency}</div>
              <div className="muted">
                Service areas: {orgSettings.serviceAreaLabel}
              </div>
            </article>

            <article className="order-card">
              <strong>Booking defaults</strong>
              <div className="muted" style={{ marginTop: 6 }}>
                {orgSettings.depositPolicy}
              </div>
              <div className="muted">{orgSettings.publicBookingLabel}</div>
            </article>
          </div>

          <div className="section-header" style={{ marginTop: 18 }}>
            <div>
              <div className="kicker">Coming soon</div>
            </div>
          </div>
          <div className="list">
            <div className="order-card">
              <strong>Team access</strong>
              <div className="muted">Owner, admin, dispatcher, crew, and viewer roles.</div>
            </div>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
