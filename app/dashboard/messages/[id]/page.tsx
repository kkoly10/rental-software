import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getThreadMessages } from "@/lib/data/messages";
import { ReplyForm } from "@/components/messages/reply-form";

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { messages, customerName, customerEmail, orderNumber } =
    await getThreadMessages(decodeURIComponent(id));

  // Extract IDs for the reply form
  const firstInbound = messages.find((m) => m.direction === "inbound");
  const customerId = firstInbound?.customer_id ?? null;
  const orderId = firstInbound?.order_id ?? null;

  return (
    <DashboardShell
      title={`Conversation with ${customerName}`}
      description={orderNumber ? `Order #${orderNumber}` : "Direct message"}
    >
      <div style={{ marginBottom: 16 }}>
        <Link href="/dashboard/messages" className="ghost-btn">
          &larr; Back to Messages
        </Link>
        {orderNumber && orderId && (
          <Link
            href={`/dashboard/orders/${orderId}`}
            className="ghost-btn"
            style={{ marginLeft: 8 }}
          >
            View Order #{orderNumber}
          </Link>
        )}
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: "1fr" }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Thread</div>
              <h2 style={{ margin: "6px 0 0" }}>
                {customerName}
                {customerEmail && (
                  <span className="muted" style={{ fontSize: 14, fontWeight: 400, marginLeft: 8 }}>
                    {customerEmail}
                  </span>
                )}
              </h2>
            </div>
          </div>

          {messages.length === 0 ? (
            <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
              <strong>No messages in this thread</strong>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className="order-card"
                  style={{
                    borderLeft:
                      msg.direction === "inbound"
                        ? "3px solid var(--primary, #1e5dcf)"
                        : "3px solid #b6e8d3",
                    background:
                      msg.direction === "outbound"
                        ? "var(--surface-alt, #f8fafb)"
                        : undefined,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <strong style={{ fontSize: 14 }}>
                        {msg.direction === "inbound"
                          ? msg.sender_name ?? msg.sender_email ?? customerName
                          : msg.sender_name ?? "You"}
                      </strong>
                      <span
                        className="muted"
                        style={{ fontSize: 12, marginLeft: 8 }}
                      >
                        via {msg.channel}
                      </span>
                    </div>
                    <span className="muted" style={{ fontSize: 12 }}>
                      {formatTime(msg.created_at)}
                    </span>
                  </div>
                  {msg.subject && (
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                      {msg.subject}
                    </div>
                  )}
                  <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {msg.body}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reply form */}
          <div style={{ marginTop: 24, paddingTop: 24, borderTop: "1px solid var(--border, #dbe6f4)" }}>
            <h3 style={{ marginBottom: 12 }}>Reply</h3>
            <ReplyForm
              customerEmail={customerEmail ?? ""}
              customerId={customerId}
              orderId={orderId}
              orderNumber={orderNumber}
            />
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
