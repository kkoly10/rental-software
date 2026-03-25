import Link from "next/link";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDocuments } from "@/lib/data/documents";

export default async function DocumentsPage() {
  const documents = await getDocuments();

  return (
    <DashboardShell
      title="Documents"
      description="Track rental agreements, safety waivers, and future inspection forms."
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
              Rental agreements and safety waivers will appear here as orders are created.
            </div>
          </div>
        ) : (
          <div className="list">
            {documents.map((document) => (
              <article key={document.id} className="order-card">
                <div className="order-row">
                  <strong>{document.name}</strong>
                  {document.orderId && (
                    <Link href={`/dashboard/orders/${document.orderId}`} className="ghost-btn">
                      View order
                    </Link>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <StatusBadge
                    label={document.agreement}
                    tone={document.agreement.toLowerCase().includes("signed") ? "success" : "warning"}
                  />
                  <StatusBadge
                    label={document.waiver}
                    tone={document.waiver.toLowerCase().includes("signed") ? "success" : "warning"}
                  />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
