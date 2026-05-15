import { getServiceStatuses } from "@/lib/env/demo-mode";
import { getMessages } from "@/lib/i18n/server";

export async function EnvStatusChecklist() {
  const statuses = getServiceStatuses();
  const allConnected = statuses.every((s) => s.connected);

  if (allConnected) return null;

  const messages = await getMessages();
  const m = messages.forms.envStatus;

  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <div className="section-header">
        <div>
          <div className="kicker">{m.kicker}</div>
          <h2 style={{ margin: "6px 0 0" }}>{m.heading}</h2>
        </div>
      </div>

      <p className="muted" style={{ margin: "0 0 16px", fontSize: 14 }}>
        {m.description}
      </p>

      <div className="list">
        {statuses.map((service) => (
          <article
            key={service.name}
            className="order-card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <strong>{service.name}</strong>
              {!service.required && (
                <span
                  className="muted"
                  style={{ fontSize: 12, marginLeft: 8 }}
                >
                  {m.optional}
                </span>
              )}
              {!service.connected && (
                <div
                  className="muted"
                  style={{ fontSize: 12, marginTop: 2, fontFamily: "monospace" }}
                >
                  {service.missingVars.join(", ")}
                </div>
              )}
            </div>
            <span
              className={`badge ${service.connected ? "success" : service.required ? "danger" : "warning"}`}
            >
              {service.connected ? m.connected : m.notConfigured}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
