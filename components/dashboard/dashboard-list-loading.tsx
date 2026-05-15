import { getMessages } from "@/lib/i18n/server";

export async function DashboardListLoading({
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
  const m = await getMessages();
  return (
    <main className="page">
      <div className="container">
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.common.loading}</div>
              <h1 style={{ margin: "6px 0 8px" }}>{title}</h1>
              <div className="muted">{description}</div>
            </div>
            {showButton ? (
              <div className="primary-btn" style={{ opacity: 0.6 }}>
                {buttonLabel ?? m.common.loading}
              </div>
            ) : null}
          </div>

          <div className="order-card" style={{ marginTop: 16, opacity: 0.7 }}>
            <div className="muted">{m.common.loading}</div>
          </div>

          <div className="list" style={{ marginTop: 16 }}>
            {Array.from({ length: 5 }).map((_, index) => (
              <article key={index} className="order-card" style={{ minHeight: 84, opacity: 0.55 }}>
                <div className="order-row">
                  <div>
                    <strong>{m.common.loading}</strong>
                    <div className="muted">{m.common.pleaseWait}</div>
                  </div>
                  <span className="badge">{m.common.loading}</span>
                </div>
                <div className="price-row">
                  <span className="muted">{m.common.pleaseWait}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
