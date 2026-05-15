import Link from "next/link";
import { getMessages } from "@/lib/i18n/server";

export default async function VerifyEmailPage() {
  const m = await getMessages();
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 620 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.auth.verifyEmail.kicker}</div>
              <h1 style={{ margin: "6px 0 8px" }}>{m.auth.verifyEmail.title}</h1>
              <div className="muted">
                {m.auth.verifyEmail.description}
              </div>
            </div>
          </div>

          <div className="list" style={{ marginTop: 16 }}>
            <div className="order-card">
              <strong>{m.auth.forgotPassword.checkInbox}</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                {m.auth.forgotPassword.checkInboxBody}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/login" className="secondary-btn">
              {m.auth.forgotPassword.backToLogin}
            </Link>
            <Link href="/signup" className="ghost-btn">
              {m.auth.login.createAccount}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
