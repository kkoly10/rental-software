export default function DashboardLoading() {
  return (
    <main className="page">
      <div className="container">
        <div className="section-header" style={{ marginBottom: 24 }}>
          <div>
            <div className="kicker" style={{ opacity: 0.4 }}>Rental platform</div>
            <div style={{ height: 28, width: 220, borderRadius: 8, background: "var(--surface-muted)", margin: "6px 0 8px" }} />
            <div style={{ height: 16, width: 300, borderRadius: 6, background: "var(--surface-muted)" }} />
          </div>
        </div>

        <div className="grid grid-4" style={{ marginBottom: 24 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card" style={{ minHeight: 80 }} />
          ))}
        </div>

        <div className="dashboard-grid">
          <div className="panel" style={{ minHeight: 200 }} />
          <div className="panel" style={{ minHeight: 200 }} />
        </div>
      </div>
    </main>
  );
}
