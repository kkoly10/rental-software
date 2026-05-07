import type { SmsLogEntry } from "@/lib/data/sms-log";

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***-***-****";
  return `***-***-${digits.slice(-4)}`;
}

function truncate(text: string, maxLen: number): string {
  return text.length <= maxLen ? text : text.slice(0, maxLen) + "…";
}

export function SmsLog({ entries }: { entries: SmsLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="order-card" style={{ textAlign: "center", padding: "24px 16px" }}>
        <div style={{ fontSize: 13, color: "var(--text-soft)" }}>
          No SMS messages sent yet.
        </div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          Messages appear here once customers opt in and confirmations are triggered.
        </div>
      </div>
    );
  }

  return (
    <div className="list">
      {entries.map((entry) => (
        <article key={entry.id} className="sms-log-entry order-card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span className="sms-phone-masked">{maskPhone(entry.phone)}</span>
            <span className={entry.status === "sent" ? "sms-status-sent" : "sms-status-failed"}>
              {entry.status}
            </span>
          </div>
          <div className="muted" style={{ fontSize: "0.875rem" }}>
            {truncate(entry.preview, 80)}
          </div>
          <div className="muted" style={{ fontSize: "0.75rem", marginTop: 4, opacity: 0.7 }}>
            {entry.timestamp}
          </div>
        </article>
      ))}
    </div>
  );
}
