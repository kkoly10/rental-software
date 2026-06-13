import Link from "next/link";
import { OnboardingForm, type VerticalOption } from "@/components/onboarding/onboarding-form";
import { getMessages } from "@/lib/i18n/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listVerticals } from "@/lib/verticals/registry";

/**
 * Build the signup vertical picker straight from the vertical registry
 * so the wizard can never drift from the verticals the app actually
 * supports (the old form hardcoded the list, which had already gone
 * stale against lib/verticals). Each card previews the seeded
 * categories and the cancellation/lead-time policy the pick locks in —
 * making the choice visibly consequential instead of cosmetic.
 */
function buildVerticalOptions(): VerticalOption[] {
  return listVerticals().map((v) => {
    const { refundWindowDays, forfeitPct, minLeadTimeHours } = v.policies;
    const lead =
      minLeadTimeHours >= 48
        ? `${Math.round(minLeadTimeHours / 24)}-day min lead`
        : `${minLeadTimeHours}h min lead`;
    const refund =
      forfeitPct === 0
        ? "Always fully refundable"
        : `${forfeitPct}% deposit forfeit within ${refundWindowDays} days`;
    return {
      value: v.slug,
      label: v.label.en,
      description: v.defaultCategorySeeds.slice(0, 4).join(" · "),
      policySummary: `${refund} · ${lead}`,
    };
  });
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ business?: string }>;
}) {
  const m = await getMessages();
  const { business } = await searchParams;

  // Account-model fix: a marketplace renter who lands here (old links,
  // direct URL) gets an explicit chooser instead of silently being
  // walked into operator-org creation. ?business=1 is the deliberate
  // "yes, I also want a business account" ceremony.
  let isRenter = false;
  if (hasSupabaseEnv() && business !== "1") {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      isRenter = user?.user_metadata?.korent_role === "renter";
    } catch {
      // fall through to the normal onboarding form
    }
  }

  if (isRenter) {
    return (
      <main className="page">
        <div className="container" style={{ maxWidth: 560 }}>
          <section className="panel" style={{ textAlign: "center", padding: "36px 28px" }}>
            <h1 style={{ margin: "0 0 8px" }}>You have a renter account</h1>
            <p className="muted" style={{ margin: "0 0 22px" }}>
              Your Korent account is set up for renting on the marketplace.
              Were you looking for your rentals — or do you want to start a
              business account too (sell on the marketplace or run a rental
              operation)?
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/market/rentals" className="primary-btn">
                Go to my rentals
              </Link>
              <Link href="/onboarding?business=1" className="secondary-btn">
                Start a business account
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

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

          <OnboardingForm verticalOptions={buildVerticalOptions()} />

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
