import Link from "next/link";

export default function VerifiedPage() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Email confirmed</div>
              <h1 style={{ margin: "6px 0 8px" }}>Your account is verified</h1>
              <div className="muted">
                You can now sign in and continue setting up your RentalOS
                operator workspace.
              </div>
            </div>
          </div>

          <div className="order-card" style={{ marginTop: 16 }}>
            <strong>What happens next?</strong>
            <div className="muted" style={{ marginTop: 8 }}>
              After you sign in, we’ll send you to onboarding if your
              organization has not been created yet.
            </div>
          </div>

          <div
            style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}
          >
            <Link href="/login" className="primary-btn">
              Sign In
            </Link>
            <Link href="/" className="ghost-btn">
              Back to Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}