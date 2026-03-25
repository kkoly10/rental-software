import { DashboardShell } from "@/components/layout/dashboard-shell";
import { BusinessProfileForm } from "@/components/settings/business-profile-form";
import { getOrgSettings } from "@/lib/data/settings";

export default async function SettingsPage() {
  const settings = await getOrgSettings();

  return (
    <DashboardShell
      title="Settings"
      description="Manage business preferences, contact info, and workspace configuration."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Business settings</div>
            <h2 style={{ margin: "6px 0 0" }}>Business profile</h2>
          </div>
        </div>

        <BusinessProfileForm
          defaults={{
            name: settings.name,
            supportEmail: settings.supportEmail,
            phone: settings.phone,
            timezone: settings.timezone,
          }}
        />
      </section>

      <section className="panel" style={{ marginTop: 18 }}>
        <div className="section-header">
          <div>
            <div className="kicker">Coming soon</div>
            <h2 style={{ margin: "6px 0 0" }}>Additional settings</h2>
          </div>
        </div>
        <div className="list">
          <div className="order-card">
            <strong>Booking defaults</strong>
            <div className="muted">Deposit rules, lead time, and public checkout behavior.</div>
          </div>
          <div className="order-card">
            <strong>Team access</strong>
            <div className="muted">Owner, admin, dispatcher, crew, and viewer roles.</div>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
