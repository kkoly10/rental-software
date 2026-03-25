import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDocumentsDetailed } from "@/lib/data/documents";
import { DocumentStatusButton } from "@/components/documents/document-actions";

export default async function DocumentsPage() {
  const documents = await getDocumentsDetailed();

  return (
    <DashboardShell
      title="Documents"
      description="Track rental agreements, safety waivers, and manage signing status."
    >
      <section className="panel">
        <div className="section-header">
          <div>
            <div className="kicker">Document status</div>
            <h2 style={{ margin: "6px 0 0" }}>Order paperwork</h2>
          </div>
        </div>

        {documents.length === 0 ? (
          <div className="order-card" style={{ textAlign: "center", padding: 32 }}>
            <strong>No documents yet</strong>
            <div className="muted" style={{ marginTop: 8 }}>
              Open an order detail page and click "Generate Documents" to create rental agreements and safety waivers.
            </div>
          </div>
        ) : (
          <div className="list">
            {documents.map((doc) => (
              <article key={doc.id} className="order-card">
                <div className="order-row">
                  <strong>{doc.customerName}</strong>
                  {doc.orderId && (
                    <Link href={`/dashboard/orders/${doc.orderId}`} className="ghost-btn" style={{ fontSize: 12 }}>
                      View order
                    </Link>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <StatusBadge
                    label={doc.agreementLabel}
                    tone={doc.agreementStatus === "signed" ? "success" : "warning"}
                  />
                  {doc.agreementId && doc.agreementStatus !== "signed" && (
                    <>
                      <DocumentStatusButton documentId={doc.agreementId} currentStatus={doc.agreementStatus} targetStatus="sent" label="Mark Sent" />
                      <DocumentStatusButton documentId={doc.agreementId} currentStatus={doc.agreementStatus} targetStatus="signed" label="Mark Signed" />
                    </>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <StatusBadge
                    label={doc.waiverLabel}
                    tone={doc.waiverStatus === "signed" ? "success" : "warning"}
                  />
                  {doc.waiverId && doc.waiverStatus !== "signed" && (
                    <>
                      <DocumentStatusButton documentId={doc.waiverId} currentStatus={doc.waiverStatus} targetStatus="sent" label="Mark Sent" />
                      <DocumentStatusButton documentId={doc.waiverId} currentStatus={doc.waiverStatus} targetStatus="signed" label="Mark Signed" />
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
