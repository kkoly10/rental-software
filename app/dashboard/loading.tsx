import { getMessages } from "@/lib/i18n/server";

export default async function DashboardLoading() {
  const m = await getMessages();
  return (
    <main className="page">
      <div className="container">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.common.loading}</div>
              <h1 style={{ margin: "6px 0 8px" }}>{m.dashboard.overview.title}</h1>
              <div className="muted">{m.dashboard.overview.description}</div>
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
