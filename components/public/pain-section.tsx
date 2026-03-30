const painPoints = [
  {
    before: "Phone tag with customers",
    after: "Customers book online 24/7",
  },
  {
    before: "Spreadsheets to track bookings",
    after: "One dashboard for orders, payments, and delivery",
  },
  {
    before: "Double-bookings and missed dates",
    after: "Real-time availability prevents conflicts",
  },
  {
    before: "Chasing deposits via text",
    after: "Automatic invoices and payment tracking",
  },
];

export function PainSection() {
  return (
    <section className="section pain-section">
      <div className="container">
        <div style={{ textAlign: "center", maxWidth: 620, margin: "0 auto 32px" }}>
          <div className="kicker">Sound familiar?</div>
          <h2 style={{ margin: "8px 0 12px" }}>
            Still running your rental business from a spreadsheet?
          </h2>
          <p className="muted" style={{ fontSize: "1.05rem" }}>
            You started this business to make events amazing — not to drown in
            admin. Here&apos;s what changes when you switch.
          </p>
        </div>

        <div className="pain-grid">
          {painPoints.map((point) => (
            <div key={point.before} className="pain-card">
              <div className="pain-before">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#df4c4c" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                <span>{point.before}</span>
              </div>
              <div className="pain-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </div>
              <div className="pain-after">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#188862" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span>{point.after}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
