import Link from "next/link";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { getMessages } from "@/lib/i18n/server";

export default async function OnboardingPage() {
  const m = await getMessages();
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 820 }}>
        <section className="panel">
          <div className="section-header">
            <div>
              <div className="kicker">{m.onboarding.kicker}</div>
              <h1 style={{ margin: "6px 0 8px" }}>{m.onboarding.title}</h1>
              <div className="muted">
                {m.onboarding.description}
              </div>
            </div>
          </div>

          <div className="grid grid-3" style={{ marginBottom: 8 }}>
            {m.onboarding.steps.map((step) => (
              <div key={step.title} className="order-card">
                <strong>{step.title}</strong>
                <div className="muted">{step.body}</div>
              </div>
            ))}
          </div>

          <OnboardingForm />

          <div style={{ marginTop: 16 }}>
            <Link href="/login" className="ghost-btn">
              {m.onboarding.backToLogin}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
