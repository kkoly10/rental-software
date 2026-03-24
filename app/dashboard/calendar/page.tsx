import { DashboardShell } from "@/components/layout/dashboard-shell";

const days = [
  ["Mon", "2 bookings"],
  ["Tue", "1 delivery"],
  ["Wed", "3 bookings"],
  ["Thu", "2 pickups"],
  ["Fri", "4 bookings"],
  ["Sat", "6 events"],
  ["Sun", "3 events"],
] as const;

export default function CalendarPage() {
  return (
    <DashboardShell
      title="Calendar"
      description="View bookings, deliveries, and upcoming event activity by day."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Schedule view</div>
            <h2 style={{ margin: "6px 0 0" }}>Weekly activity</h2>
          </div>
        </div>
        <div className="grid grid-4">
          {days.map(([day, note]) => (
            <div key={day} className="order-card">
              <strong>{day}</strong>
              <div className="muted">{note}</div>
            </div>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
