import Link from "next/link";

export default function OnboardingPage() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 820 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Getting started</div>
              <h1 style={{ margin: "6px 0 8px" }}>Set up your rental business</h1>
              <div className="muted">Create your organization, choose your service area, and prepare your first products.</div>
            </div>
          </div>
          <div className="grid grid-3">
            <div className="order-card"><strong>Business profile</strong><div className="muted">Brand, timezone, and contact basics.</div></div>
            <div className="order-card"><strong>Service area</strong><div className="muted">ZIP coverage, fees, and order minimums.</div></div>
            <div className="order-card"><strong>Catalog starter</strong><div className="muted">Create your first inflatable and publish it.</div></div>
          </div>
          <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
            <Link href="/dashboard" className="primary-btn">Continue</Link>
            <Link href="/signup" className="secondary-btn">Back</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
