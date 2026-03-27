import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

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
  const params = await searchParams;
  const redirectTo =
    typeof params.redirect === "string" ? params.redirect : undefined;

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 560 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Account access</div>
              <h1 style={{ margin: "6px 0 8px" }}>Login</h1>
              <div className="muted">
                Sign in to manage bookings, deliveries, and inventory.
              </div>
            </div>
          </div>

          {params.reset === "success" ? (
            <div className="order-card" style={{ marginTop: 16 }}>
              <strong>Password updated</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                Sign in with your new password.
              </div>
            </div>
          ) : null}

          {params.verified === "1" ? (
            <div className="order-card" style={{ marginTop: 16 }}>
              <strong>Email verified</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                Your email is confirmed. You can sign in now.
              </div>
            </div>
          ) : null}

          {params.message ? (
            <div className="order-card" style={{ marginTop: 16 }}>
              <strong>Notice</strong>
              <div className="muted" style={{ marginTop: 8 }}>
                {params.message}
              </div>
            </div>
          ) : null}

          <LoginForm redirectTo={redirectTo} />

          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link href="/signup" className="secondary-btn">
              Create Account
            </Link>
            <Link href="/forgot-password" className="ghost-btn">
              Forgot Password
            </Link>
            <Link href="/" className="ghost-btn">
              Back to Home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}