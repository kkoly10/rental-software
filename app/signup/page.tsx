import Link from "next/link";
import { notFound } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { isTenantHost } from "@/lib/auth/org-context";
import { getMessages } from "@/lib/i18n/server";

export default async function SignupPage() {
  if (await isTenantHost()) notFound();

  const m = await getMessages();

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 620 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.auth.signup.kicker}</div>
              <h1 style={{ margin: "6px 0 8px" }}>{m.auth.signup.title}</h1>
              <div className="muted">
                {m.auth.signup.description}
              </div>
            </div>
          </div>

          <SignupForm />

          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <Link href="/login" className="secondary-btn">
              {m.auth.forgotPassword.backToLogin}
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
