import type { XeroStatus } from "@/lib/data/xero-status";

/**
 * Settings → Integrations → Xero card (Sprint 3.5). Server-rendered;
 * mirror of the QuickBooks card with Xero-specific copy. Connect is a
 * link to the OAuth kickoff route, Disconnect is a form POST.
 */
export function XeroCard({ status }: { status: XeroStatus }) {
  if (!status.configured) {
    return (
      <article className="order-card">
        <strong>Xero</strong>
        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          Xero integration isn't configured on this deploy. Set
          <code style={{ margin: "0 4px" }}>XERO_CLIENT_ID</code>,
          <code style={{ margin: "0 4px" }}>XERO_CLIENT_SECRET</code>, and
          <code style={{ margin: "0 4px" }}>XERO_REDIRECT_URI</code> in the
          environment to enable.
        </div>
      </article>
    );
  }

  if (!status.connected) {
    return (
      <article className="order-card">
        <strong>Xero</strong>
        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          Push paid invoices into Xero so your accountant has up-to-date
          books without copying anything by hand. Same data shape as
          QuickBooks — connect one or both.
        </div>
        <div style={{ marginTop: 12 }}>
          <a
            href="/api/integrations/xero/connect"
            className="primary-btn"
            style={{ display: "inline-block", fontSize: 13 }}
          >
            Connect Xero
          </a>
        </div>
      </article>
    );
  }

  return (
    <article className="order-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <strong>Xero</strong>
          <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>
            Connected. Paid invoices sync automatically.
          </div>
          {status.connectedAt && (
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Connected since {new Date(status.connectedAt).toLocaleDateString()}
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
        <form action="/api/integrations/xero/disconnect" method="post" style={{ flexShrink: 0 }}>
          <button type="submit" className="ghost-btn" style={{ fontSize: 13 }}>
            Disconnect
          </button>
        </form>
      </div>
    </article>
  );
}
