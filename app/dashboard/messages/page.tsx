import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getConversations } from "@/lib/data/messages";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default async function MessagesPage() {
  const conversations = await getConversations();

  return (
    <DashboardShell
      title="Messages"
      description="Customer conversations from the portal and dashboard."
    >
      <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr" }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Inbox</div>
              <h2 style={{ margin: "6px 0 0" }}>Conversations</h2>
              <div className="muted" style={{ marginTop: 8 }}>
                {conversations.length} conversation{conversations.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {conversations.length === 0 ? (
            <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
              <strong>No messages yet</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                Customer messages from the portal will appear here.
              </div>
            </div>
          ) : (
            <div className="list">
              {conversations.map((conv) => (
                <Link
                  key={conv.id}
                  href={`/dashboard/messages/${encodeURIComponent(conv.id)}`}
                  className="order-card"
                  style={{
                    display: "block",
                    textDecoration: "none",
                    color: "inherit",
                    borderLeft: conv.unread_count > 0 ? "3px solid var(--primary, #1e5dcf)" : undefined,
                  }}
                >
                  <div className="order-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <strong>{conv.customer_name}</strong>
                        {conv.unread_count > 0 && (
                          <span
                            className="badge"
                            style={{
                              background: "var(--primary, #1e5dcf)",
                              color: "#fff",
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: 999,
                            }}
                          >
                            {conv.unread_count}
                          </span>
                        )}
                        {conv.order_number && (
                          <span className="muted" style={{ fontSize: 13 }}>
                            #{conv.order_number}
                          </span>
                        )}
                      </div>
                      {conv.last_subject && (
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: conv.unread_count > 0 ? 600 : 400,
                            marginTop: 4,
                          }}
                        >
                          {conv.last_subject}
                        </div>
                      )}
                      <div
                        className="muted"
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {conv.last_direction === "outbound" && "You: "}
                        {conv.last_body}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {relativeTime(conv.last_created_at)}
                      </div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {conv.message_count} msg{conv.message_count === 1 ? "" : "s"}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
