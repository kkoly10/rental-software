import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getMaintenanceRecords } from "@/lib/data/maintenance";

export default async function MaintenancePage() {
  const records = await getMaintenanceRecords();

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
            <article key={record.id} className="order-card">
              <strong>{record.name}</strong>
              <div className="muted">{record.status}</div>
              <div className="muted">{record.note}</div>
              <div className="muted">
                Opened: {record.openedAt} · Cost: {record.costLabel}
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}