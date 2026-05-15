import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { getMessages } from "@/lib/i18n/server";

export default async function ForgotPasswordPage() {
  const m = await getMessages();
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.auth.forgotPassword.kicker}</div>
              <h1 style={{ margin: "6px 0 8px" }}>{m.auth.forgotPassword.title}</h1>
              <div className="muted">
                {m.auth.forgotPassword.description}
              </div>
            </div>
          </div>

          <ForgotPasswordForm />
        </section>
      </div>
    </main>
  );
}
