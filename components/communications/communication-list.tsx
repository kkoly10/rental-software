import type { CommunicationEntry } from "@/lib/data/communication-history";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  portal_message: "Message",
  system: "System",
};

const CHANNEL_COLORS: Record<string, string> = {
  email: "var(--primary)",
  sms: "#059669",
  portal_message: "#7c3aed",
  system: "#6b7280",
};

function formatTimestamp(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CommunicationList({
  entries,
  showOrderNumber,
}: {
  entries: CommunicationEntry[];
  showOrderNumber?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <div className="order-card" style={{ textAlign: "center", padding: 24 }}>
        <div className="muted">No communications recorded yet.</div>
      </div>
    );
  }

  return (
    <div className="list">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="order-card"
          style={{
            borderLeft: `3px solid ${CHANNEL_COLORS[entry.channel] ?? "var(--border)"}`,
            ...(entry.status === "failed" ? { background: "var(--surface-danger, #fef2f2)" } : {}),
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                className="badge default"
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  background: CHANNEL_COLORS[entry.channel] ?? "var(--border)",
                  color: "#fff",
                }}
              >
                {CHANNEL_LABELS[entry.channel] ?? entry.channel}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-soft)" }}>
                {entry.direction === "outbound" ? "→" : "←"}
              </span>
              {entry.recipient && (
                <span style={{ fontSize: 13 }}>{entry.recipient}</span>
              )}
              {entry.status === "failed" && (
                <span className="badge warning" style={{ fontSize: 11, padding: "2px 6px" }}>
                  Failed
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: "var(--text-soft)", whiteSpace: "nowrap" }}>
              {formatTimestamp(entry.createdAt)}
            </span>
          </div>

          {(entry.subject || entry.bodyPreview || (showOrderNumber && entry.orderNumber)) && (
            <div style={{ marginTop: 6 }}>
              {showOrderNumber && entry.orderNumber && (
                <div style={{ fontSize: 12, color: "var(--text-soft)" }}>
                  Order #{entry.orderNumber}
                </div>
              )}
              {entry.subject && (
                <div style={{ fontSize: 13, fontWeight: 500 }}>{entry.subject}</div>
              )}
              {entry.bodyPreview && (
                <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
                  {entry.bodyPreview.length > 120
                    ? entry.bodyPreview.slice(0, 120) + "…"
                    : entry.bodyPreview}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
