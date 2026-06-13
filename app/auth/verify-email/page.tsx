import Link from "next/link";
import { getMessages } from "@/lib/i18n/server";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";

export default async function VerifyEmailPage() {
  const m = await getMessages();
  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/korent-icon.svg" alt="" />
          <b>Korent</b>
        </div>

        <div className="eyebrow eyebrow--accent">{m.auth.verifyEmail.kicker}</div>
        <h1 className="auth-title">{m.auth.verifyEmail.title}</h1>
        <div className="auth-sub">{m.auth.verifyEmail.description}</div>

        <div className="auth-notice">
          <strong>{m.auth.verifyEmail.tipTitle}</strong>
          <div className="muted" style={{ marginTop: 6 }}>
            {m.auth.verifyEmail.tipBody}
          </div>
        </div>

        <div style={{ marginTop: 18 }}>
          <div className="muted" style={{ fontSize: 13, marginBottom: 6 }}>
            {m.auth.verifyEmail.didntGet}
          </div>
          <ResendVerificationForm />
        </div>

        <div className="auth-alt">
          <Link href="/login" className="secondary-btn">
            {m.auth.forgotPassword.backToLogin}
          </Link>
          <Link href="/signup" className="ghost-btn">
            {m.auth.login.createAccount}
          </Link>
        </div>
      </div>
    </main>
  );
}
