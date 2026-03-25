import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 620 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Create account</div>
              <h1 style={{ margin: "6px 0 8px" }}>Sign Up</h1>
              <div className="muted">
                Create your operator account and start setting up your rental business.
              </div>
            </div>
          </div>

          <SignupForm />

          <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
            <Link href="/login" className="secondary-btn">
              Back to Login
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
