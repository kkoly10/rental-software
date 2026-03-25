import Link from "next/link";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";

export default function OnboardingPage() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 820 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">Getting started</div>
              <h1 style={{ margin: "6px 0 8px" }}>Set up your rental business</h1>
              <div className="muted">
                Create your organization, set your primary service area, and get starter
                categories seeded automatically.
              </div>
            </div>
          </div>

          <div className="grid grid-3" style={{ marginBottom: 8 }}>
            <div className="order-card">
              <strong>1. Business profile</strong>
              <div className="muted">Name, timezone, and branding.</div>
            </div>
            <div className="order-card">
              <strong>2. Service area</strong>
              <div className="muted">ZIP coverage, delivery fee, and order minimum.</div>
            </div>
            <div className="order-card">
              <strong>3. Auto-seeded catalog</strong>
              <div className="muted">Starter inflatable categories created for you.</div>
            </div>
          </div>

          <OnboardingForm />

          <div style={{ marginTop: 16 }}>
            <Link href="/login" className="ghost-btn">
              Back to Login
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
