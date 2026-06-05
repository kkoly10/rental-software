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
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/korent-icon.svg" alt="" />
          <b>Korent</b>
        </div>

        <div className="eyebrow eyebrow--accent">{m.auth.login.kicker}</div>
        <h1 className="auth-title">{m.auth.login.title}</h1>
        <div className="auth-sub">{m.auth.login.description}</div>

        {params.reset === "success" ? (
          <div className="auth-notice">
            <strong>{m.auth.login.passwordUpdated}</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              {m.auth.login.passwordUpdatedHint}
            </div>
          </div>
        ) : null}

        {params.verified === "1" ? (
          <div className="auth-notice">
            <strong>{m.auth.login.emailVerified}</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              {m.auth.login.emailVerifiedHint}
            </div>
          </div>
        ) : null}

        {params.message ? (
          <div className="auth-notice">
            <strong>{m.auth.login.notice}</strong>
            <div className="muted" style={{ marginTop: 6 }}>
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

        <div className="auth-alt">
          <Link href="/signup" className="secondary-btn">
            {m.auth.login.createAccount}
          </Link>
          <Link href="/" className="ghost-btn">
            {m.common.backToHome}
          </Link>
        </div>
      </div>
    </main>
  );
}
