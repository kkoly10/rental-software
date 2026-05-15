import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getMaintenanceRecords } from "@/lib/data/maintenance";
import { getProductsPage } from "@/lib/data/products";
import { LogMaintenanceForm } from "@/components/maintenance/log-form";
import { MaintenanceStatusButton } from "@/components/maintenance/status-button";
import { getMessages } from "@/lib/i18n/server";

export default async function MaintenancePage() {
  const [records, productsResult, m] = await Promise.all([
    getMaintenanceRecords(),
    getProductsPage({ pageSize: 200 }),
    getMessages(),
  ]);

  const products = productsResult.items.map((p) => ({ id: p.id, name: p.name }));

  return (
    <DashboardShell
      title={m.dashboard.maintenance.title}
      description={m.dashboard.maintenance.description}
    >
      <div className="dashboard-grid" style={{ gridTemplateColumns: "2fr 1fr", alignItems: "start" }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Asset readiness</div>
              <h2 style={{ margin: "6px 0 0" }}>Maintenance queue</h2>
            </div>
          </div>

          {records.length === 0 ? (
            <div className="order-card" style={{ textAlign: "center", padding: "32px 16px" }}>
              <strong>No maintenance records</strong>
              <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>
                Use the form to log the first service, repair, or inspection.
              </div>
            </div>
          ) : (
            <div className="list">
              {records.map((record) => (
                <article key={record.id} className="order-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div>
                      <strong>{record.name}</strong>
                      <div className="muted" style={{ fontSize: 13 }}>{record.status}</div>
                      {record.note && <div className="muted" style={{ fontSize: 12 }}>{record.note}</div>}
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        Opened: {record.openedAt} · Cost: {record.costLabel}
                      </div>
                    </div>
                    <MaintenanceStatusButton recordId={record.id} currentStatus={record.status} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">New record</div>
              <h2 style={{ margin: "6px 0 0" }}>Log maintenance</h2>
            </div>
          </div>
          {products.length === 0 ? (
            <div className="order-card" style={{ padding: 16, fontSize: 13, color: "var(--text-soft)" }}>
              Add products to your catalog before logging maintenance.
            </div>
          ) : (
            <LogMaintenanceForm products={products} />
          )}
        </aside>
      </div>
    </DashboardShell>
  );
}
