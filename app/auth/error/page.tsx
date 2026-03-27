import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;
  const message = params.message || "We could not complete that authentication request.";

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 620 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Authentication issue</div>
              <h1 style={{ margin: "6px 0 8px" }}>Something went wrong</h1>
              <div className="muted">The login, verification, or recovery flow could not be completed.</div>
            </div>
          </div>

          <div className="order-card" style={{ marginTop: 16 }}>
            <strong>Details</strong>
            <div className="muted" style={{ marginTop: 8 }}>{message}</div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/login" className="primary-btn">
              Back to Login
            </Link>
            <Link href="/forgot-password" className="ghost-btn">
              Reset Password
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
