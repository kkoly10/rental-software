import { DashboardShell } from "@/components/layout/dashboard-shell";
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

        <div className="list">
          {documents.map((document) => (
            <article key={document.id} className="order-card">
              <strong>{document.name}</strong>
              <div className="muted">{document.agreement}</div>
              <div className="muted">{document.waiver}</div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}