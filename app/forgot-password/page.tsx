import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Password recovery</div>
              <h1 style={{ margin: "6px 0 8px" }}>Forgot your password?</h1>
              <div className="muted">
                Enter your account email and we&rsquo;ll send you a secure reset link.
              </div>
            </div>
          </div>

          <ForgotPasswordForm />
        </section>
      </div>
    </main>
  );
}
