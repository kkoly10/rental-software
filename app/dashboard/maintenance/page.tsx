import { DashboardShell } from "@/components/layout/dashboard-shell";

const records = [
  {
    name: "Tropical Combo",
    status: "Open maintenance",
    note: "Seam inspection and blower check pending",
  },
  {
    name: "Mega Splash Water Slide",
    status: "Ready",
    note: "Cleaned and inspected after weekend rental",
  },
  {
    name: "Generator Add-on",
    status: "Service due",
    note: "Oil change reminder before next heavy weekend",
  },
];

export default function MaintenancePage() {
  return (
    <DashboardShell
      title="Maintenance"
      description="Monitor repairs, service reminders, and rental readiness across assets."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Asset readiness</div>
            <h2 style={{ margin: "6px 0 0" }}>Maintenance queue</h2>
          </div>
        </div>
        <div className="list">
          {records.map((record) => (
            <article key={record.name} className="order-card">
              <strong>{record.name}</strong>
              <div className="muted">{record.status}</div>
              <div className="muted">{record.note}</div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}