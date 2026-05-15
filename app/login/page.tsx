import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";
import { getMessages } from "@/lib/i18n/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    redirect?: string;
    reset?: string;
    verified?: string;
    message?: string;
  }>;
}) {
  const [params, m] = await Promise.all([searchParams, getMessages()]);
  const redirectTo =
    typeof params.redirect === "string" ? params.redirect : undefined;

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.auth.login.kicker}</div>
              <h1 style={{ margin: "6px 0 8px" }}>{m.auth.login.title}</h1>
              <div className="muted">
                {m.auth.login.description}
              </div>
            </div>
          </div>

          {params.reset === "success" ? (
            <div className="order-card" style={{ marginTop: 16 }}>
              <strong>{m.auth.login.passwordUpdated}</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                {m.auth.login.passwordUpdatedHint}
              </div>
            </div>
          ) : null}

          {params.verified === "1" ? (
            <div className="order-card" style={{ marginTop: 16 }}>
              <strong>{m.auth.login.emailVerified}</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                {m.auth.login.emailVerifiedHint}
              </div>
            </div>
          ) : null}

          {params.message ? (
            <div className="order-card" style={{ marginTop: 16 }}>
              <strong>{m.auth.login.notice}</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                {params.message}
              </div>
            </div>
          ) : null}

          <LoginForm
            redirectTo={redirectTo}
            labels={{
              email: m.auth.form.email,
              emailPlaceholder: m.auth.form.emailPlaceholder,
              password: m.auth.form.password,
              passwordPlaceholder: m.auth.form.passwordPlaceholder,
              signIn: m.auth.form.signIn,
              signingIn: m.auth.form.signingIn,
              forgotPasswordLink: m.auth.form.forgotPasswordLink,
            }}
          />

          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/signup" className="secondary-btn">
              {m.auth.login.createAccount}
            </Link>
            <Link href="/forgot-password" className="ghost-btn">
              {m.auth.login.forgotPassword}
            </Link>
            <Link href="/" className="ghost-btn">
              {m.common.backToHome}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
