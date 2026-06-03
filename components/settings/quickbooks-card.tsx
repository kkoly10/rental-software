import type { QuickBooksStatus } from "@/lib/data/quickbooks-status";

/**
 * Settings → Integrations → QuickBooks card (Sprint 2).
 *
 * Server-rendered. The Connect button is a plain link to the OAuth
 * kickoff route; Disconnect is a form POST that hits the disconnect
 * route. No client JS needed for either path — keeps the surface area
 * small and the secrets entirely server-side.
 */
export function QuickBooksCard({ status }: { status: QuickBooksStatus }) {
  return <Inner status={status} />;
}

function Inner({ status }: { status: QuickBooksStatus }) {
  if (!status.configured) {
    return (
      <article className="order-card">
        <strong>QuickBooks Online</strong>
        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          QuickBooks integration isn't configured on this deploy. Set
          <code style={{ margin: "0 4px" }}>QBO_CLIENT_ID</code>,
          <code style={{ margin: "0 4px" }}>QBO_CLIENT_SECRET</code>, and
          <code style={{ margin: "0 4px" }}>QBO_REDIRECT_URI</code> in the
          environment to enable.
        </div>
      </article>
    );
  }

  if (!status.connected) {
    return (
      <article className="order-card">
        <strong>QuickBooks Online</strong>
        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          Sync paid invoices into your QuickBooks account so your
          accountant has up-to-date books without copying anything by
          hand.
        </div>
        <div style={{ marginTop: 12 }}>
          <a
            href="/api/integrations/quickbooks/connect"
            className="primary-btn"
            style={{ display: "inline-block", fontSize: 13 }}
          >
            Connect QuickBooks
          </a>
        </div>
      </article>
    );
  }

  return (
    <article className="order-card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div>
          <strong>QuickBooks Online</strong>
          <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            Connected. Paid invoices sync automatically.
          </div>
          {status.connectedAt && (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Connected since{" "}
              {new Date(status.connectedAt).toLocaleDateString()}
            </div>
          )}
          {status.lastSyncAt && (
            <div className="muted" style={{ fontSize: 12 }}>
              Last sync: {new Date(status.lastSyncAt).toLocaleString()}
            </div>
          )}
          {status.lastSyncError && (
            <div
              className="badge warning"
              style={{ fontSize: 12, marginTop: 6 }}
              role="alert"
            >
              Last sync error: {status.lastSyncError}
            </div>
          )}
        </div>
        <form
          action="/api/integrations/quickbooks/disconnect"
          method="post"
          style={{ flexShrink: 0 }}
        >
          <button
            type="submit"
            className="ghost-btn"
            style={{ fontSize: 13 }}
          >
            Disconnect
          </button>
        </form>
      </div>
    </article>
  );
}
