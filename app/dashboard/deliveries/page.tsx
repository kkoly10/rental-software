import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";

const columns = [
  {
    title: "Assigned",
    items: [
      ["Johnson Birthday", "Castle Bouncer", "9:00 AM"],
      ["School Field Day", "Water Slide", "10:30 AM"]
    ]
  },
  {
    title: "Out for Delivery",
    items: [["Church Event", "Obstacle Course", "In Transit"]]
  },
  {
    title: "Completed",
    items: [["Backyard Party", "Combo Unit", "Setup Done"]]
  }
] as const;

export default function DeliveriesPage() {
  return (
    <DashboardShell
      title="Delivery Board"
      description="Track routes, stop status, and crew progress."
    >
      <div className="delivery-board">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Operations</div>
              <h2 style={{ margin: "6px 0 0" }}>Today's route board</h2>
            </div>
            <StatusBadge label="Live" tone="success" />
          </div>
          <div className="board-columns">
            {columns.map((column) => (
              <div key={column.title} className="column">
                <h3>{column.title}</h3>
                <div className="list">
                  {column.items.map(([customer, item, time]) => (
                    <div key={customer} className="delivery-card">
                      <strong>{customer}</strong>
                      <div className="muted">{item}</div>
                      <div className="muted">{time}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside className="map-card">
          <div className="kicker">Route detail</div>
          <h2 style={{ marginTop: 8 }}>Crew A overview</h2>
          <div className="list">
            <div className="order-card">Truck 1 · 3 stops · 1 pickup later</div>
            <div className="order-card">Next stop: Johnson Birthday · Stafford</div>
            <div className="order-card">Checklist: blower, tarp, stakes, cords</div>
            <div className="order-card">Future map and signature tools go here</div>
          </div>
        </aside>
      </div>
    </DashboardShell>
  );
}
