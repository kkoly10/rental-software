import Link from "next/link";
import { getMessages } from "@/lib/i18n/server";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const [params, m] = await Promise.all([searchParams, getMessages()]);
  const message = params.message || m.auth.error.description;

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 620 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.auth.error.title}</div>
              <h1 style={{ margin: "6px 0 8px" }}>{m.errors.generic.title}</h1>
              <div className="muted">{m.auth.error.description}</div>
            </div>
          </div>

          <div className="order-card" style={{ marginTop: 16 }}>
            <strong>{m.auth.login.notice}</strong>
            <div className="muted" style={{ marginTop: 8 }}>{message}</div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/login" className="primary-btn">
              {m.auth.forgotPassword.backToLogin}
            </Link>
            <Link href="/forgot-password" className="ghost-btn">
              {m.auth.form.resetPassword}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
