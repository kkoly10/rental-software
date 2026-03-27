import Link from "next/link";

export default function VerifyEmailPage() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 620 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Check your inbox</div>
              <h1 style={{ margin: "6px 0 8px" }}>Verify your email</h1>
              <div className="muted">
                We sent a verification link to your email address. Open it to activate your operator account before signing in.
              </div>
            </div>
          </div>

          <div className="list" style={{ marginTop: 16 }}>
            <div className="order-card">
              <strong>Next step</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                Click the verification link in your email. Once confirmed, we&rsquo;ll send you to onboarding so you can finish setting up your rental business.
              </div>
            </div>
            <div className="order-card">
              <strong>Didn&rsquo;t get the email?</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                Check your spam or promotions folder, then try signing up again if needed.
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/login" className="secondary-btn">
              Back to Login
            </Link>
            <Link href="/signup" className="ghost-btn">
              Create Account Again
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
