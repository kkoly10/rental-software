export default function DashboardLoading() {
  return (
    <main className="page">
      <div className="container">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Loading</div>
              <h1 style={{ margin: "6px 0 8px" }}>Preparing dashboard</h1>
              <div className="muted">Loading bookings, deliveries, and inventory data.</div>
            </div>
          </div>
          <div className="grid grid-4">
            <div className="stat-card" />
            <div className="stat-card" />
            <div className="stat-card" />
            <div className="stat-card" />
          </div>
        </section>
      </div>
    </main>
  );
}
