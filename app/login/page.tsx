import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Account access</div>
              <h1 style={{ margin: "6px 0 8px" }}>Login</h1>
              <div className="muted">Sign in to manage bookings, deliveries, and inventory.</div>
            </div>
          </div>
          <div className="list">
            <div className="order-card">Email field</div>
            <div className="order-card">Password field</div>
            <div className="order-card">Remember me and forgot password actions</div>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <button className="primary-btn">Sign In</button>
            <Link href="/signup" className="secondary-btn">Create Account</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
