import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/env";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage() {
  let hasRecoverySession = false;

  if (hasSupabaseEnv()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    hasRecoverySession = Boolean(session);
  }

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Update password</div>
              <h1 style={{ margin: "6px 0 8px" }}>Set a new password</h1>
              <div className="muted">
                Choose a strong new password for your Korent operator account.
              </div>
            </div>
          </div>

          {!hasRecoverySession ? (
            <div className="order-card" style={{ marginTop: 16 }}>
              <strong>Recovery link required</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                Open this page from the password recovery email so we can verify your reset request.
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
