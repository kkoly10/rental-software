import Link from "next/link";
import { getMessages } from "@/lib/i18n/server";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const [params, m] = await Promise.all([searchParams, getMessages()]);
  const raw = params.message ?? "";

  // A confirmation/recovery link that can't be completed is almost always
  // one of: expired, already used, or opened in a different browser than
  // the user signed up in (the mobile mail-app in-app-browser + PKCE
  // case). Detect those and show a friendly, actionable message with a
  // resend form instead of leaking the raw Supabase/PKCE error text.
  const isLinkProblem =
    !raw || /verifier|pkce|expired|invalid|otp|token|code/i.test(raw);

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/korent-icon.svg" alt="" />
          <b>Korent</b>
        </div>

        <div className="eyebrow eyebrow--accent">{m.auth.error.title}</div>
        <h1 className="auth-title">{m.errors.generic.title}</h1>
        <div className="auth-sub">
          {isLinkProblem ? m.auth.error.linkProblem : m.auth.error.description}
        </div>

        {isLinkProblem ? (
          <div style={{ marginTop: 18 }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
              {m.auth.error.linkProblemHint}
            </div>
            <ResendVerificationForm />
          </div>
        ) : (
          <div className="auth-notice">
            <strong>{m.auth.login.notice}</strong>
            <div className="muted" style={{ marginTop: 8 }}>{raw}</div>
          </div>
        )}

        <div className="auth-alt">
          <Link href="/login" className="secondary-btn">
            {m.auth.forgotPassword.backToLogin}
          </Link>
          <Link href="/forgot-password" className="ghost-btn">
            {m.auth.form.resetPassword}
          </Link>
        </div>
      </div>
    </main>
  );
}
