import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function SettingsPage() {
  return (
    <DashboardShell
      title="Settings"
      description="Manage business preferences, branding defaults, and future billing integrations."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Business settings</div>
            <h2 style={{ margin: "6px 0 0" }}>Workspace configuration</h2>
          </div>
        </div>
        <div className="list">
          <div className="order-card">
            <strong>Business profile</strong>
            <div className="muted">Name, phone, support email, timezone, and currency.</div>
          </div>
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
