import Link from "next/link";
import { notFound } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { isTenantHost } from "@/lib/auth/org-context";
import { getMessages } from "@/lib/i18n/server";
import { buildVerticalOptions } from "@/lib/verticals/options";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  if (await isTenantHost()) notFound();

  const [params, m] = await Promise.all([searchParams, getMessages()]);

  return (
    <main className="auth-wrap">
      <div className="auth-card auth-card--wide">
        <div className="auth-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/korent-icon.svg" alt="" />
          <b>Korent</b>
        </div>

        <div className="eyebrow eyebrow--accent">{m.auth.signup.kicker}</div>
        <h1 className="auth-title">{m.auth.signup.title}</h1>
        <div className="auth-sub">{m.auth.signup.description}</div>

        {params.message ? (
          <div className="auth-notice">
            <strong>{m.auth.login.notice}</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              {params.message}
            </div>
          </div>
        ) : null}

        <SignupForm verticalOptions={buildVerticalOptions()} />

        <div className="auth-alt">
          <Link href="/login" className="secondary-btn">
            {m.auth.forgotPassword.backToLogin}
          </Link>
          <Link href="/" className="ghost-btn">
            {m.common.backToHome}
          </Link>
        </div>
      </div>
    </main>
  );
}
