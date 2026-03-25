import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
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

          <LoginForm />

          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <Link href="/signup" className="secondary-btn">
              Create Account
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
