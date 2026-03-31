"use client";

type SmsLogEntry = {
  id: string;
  phone: string;
  preview: string;
  timestamp: string;
  status: "sent" | "failed";
};

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***-***-****";
  const last4 = digits.slice(-4);
  return `***-***-${last4}`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "...";
}

const demoLog: SmsLogEntry[] = [
  {
    id: "sms-1",
    phone: "+15405550134",
    preview:
      "Bounce Back Rentals: Your order #1047 is confirmed! We'll be in touch with delivery details.",
    timestamp: "Today, 2:15 PM",
    status: "sent",
  },
  {
    id: "sms-2",
    phone: "+15405550178",
    preview:
      "Bounce Back Rentals: Our crew is on the way with order #1044! ETA: 10:30 AM.",
    timestamp: "Today, 9:48 AM",
    status: "sent",
  },
  {
    id: "sms-3",
    phone: "+15405550192",
    preview:
      "Bounce Back Rentals: Payment of $425.00 received for order #1042. Thank you!",
    timestamp: "Yesterday, 4:30 PM",
    status: "sent",
  },
  {
    id: "sms-4",
    phone: "+15405550201",
    preview:
      "Bounce Back Rentals: Reminder — a $106.25 deposit is due for order #1039.",
    timestamp: "Yesterday, 10:00 AM",
    status: "failed",
  },
  {
    id: "sms-5",
    phone: "+15405550145",
    preview:
      "Bounce Back Rentals: Order #1038 has been delivered and set up. Enjoy your event!",
    timestamp: "Mar 28, 3:15 PM",
    status: "sent",
  },
];

export function SmsLog() {
  return (
    <div className="list">
      {demoLog.map((entry) => (
        <article key={entry.id} className="sms-log-entry order-card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <span className="sms-phone-masked">{maskPhone(entry.phone)}</span>
            <span
              className={
                entry.status === "sent"
                  ? "sms-status-sent"
                  : "sms-status-failed"
              }
            >
              {entry.status}
            </span>
          </div>
          <div className="muted" style={{ fontSize: "0.875rem" }}>
            {truncate(entry.preview, 80)}
          </div>
          <div
            className="muted"
            style={{ fontSize: "0.75rem", marginTop: 4, opacity: 0.7 }}
          >
            {entry.timestamp}
          </div>
        </article>
      ))}
    </div>
  );
}
