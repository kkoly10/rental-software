import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { getMessages } from "@/lib/i18n/server";

export default async function ResetPasswordPage() {
  let hasRecoverySession = false;

  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    hasRecoverySession = Boolean(session);
  }

  const m = await getMessages();

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.auth.resetPassword.kicker}</div>
              <h1 style={{ margin: "6px 0 8px" }}>{m.auth.resetPassword.title}</h1>
              <div className="muted">
                {m.auth.resetPassword.description}
              </div>
            </div>
          </div>

          {!hasRecoverySession ? (
            <div className="order-card" style={{ marginTop: 16 }}>
              <strong>{m.auth.login.notice}</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                {m.auth.forgotPassword.checkInboxBody}
              </div>
            </div>
          ) : (
            <ResetPasswordForm />
          )}
        </section>
      </div>
    </main>
  );
}
