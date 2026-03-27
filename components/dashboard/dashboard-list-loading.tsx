export function DashboardListLoading({
  title,
  description,
  buttonLabel,
  showButton = false,
}: {
  title: string;
  description: string;
  buttonLabel?: string;
  showButton?: boolean;
}) {
  return (
    <main className="page">
      <div className="container">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Loading</div>
              <h1 style={{ margin: "6px 0 8px" }}>{title}</h1>
              <div className="muted">{description}</div>
            </div>
            {showButton ? (
              <div className="primary-btn" style={{ opacity: 0.6 }}>
                {buttonLabel ?? "Loading..."}
              </div>
            ) : null}
          </div>

          <div className="order-card" style={{ marginTop: 16, opacity: 0.7 }}>
            <div className="muted">Loading records…</div>
          </div>

          <div className="list" style={{ marginTop: 16 }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <article key={index} className="order-card" style={{ minHeight: 84, opacity: 0.55 }}>
                <div className="order-row">
                  <div>
                    <strong>Loading item {index + 1}</strong>
                    <div className="muted">Preparing dashboard data</div>
                  </div>
                  <span className="badge">Loading</span>
                </div>
                <div className="price-row">
                  <span className="muted">Please wait</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
