import { DashboardShell } from "@/components/layout/dashboard-shell";

const docs = [
  {
    name: "Johnson Birthday Setup",
    agreement: "Rental agreement signed",
    waiver: "Safety waiver signed",
  },
  {
    name: "Church Spring Event",
    agreement: "Agreement pending",
    waiver: "Waiver pending",
  },
  {
    name: "School Field Day",
    agreement: "Rental agreement signed",
    waiver: "Safety waiver signed",
  },
];

export default function DocumentsPage() {
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
          {docs.map((doc) => (
            <article key={doc.name} className="order-card">
              <strong>{doc.name}</strong>
              <div className="muted">{doc.agreement}</div>
              <div className="muted">{doc.waiver}</div>
            </article>
          ))}
        </div>
      </section>
    </DashboardShell>
  );
}
