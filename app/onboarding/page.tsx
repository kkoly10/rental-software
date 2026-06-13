import Link from "next/link";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { getMessages } from "@/lib/i18n/server";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildVerticalOptions } from "@/lib/verticals/options";
import { listVerticalSlugs } from "@/lib/verticals/registry";

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
  // Vertical the operator picked on the signup page, stashed in auth
  // metadata so it survives the email-verify round trip. Used to
  // pre-select the onboarding picker; empty when they signed up without
  // choosing (or via a path that doesn't set it).
  let initialVertical = "";
  if (hasSupabaseEnv()) {
    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (business !== "1") {
        isRenter = user?.user_metadata?.korent_role === "renter";
      }
      const picked = user?.user_metadata?.business_type;
      if (typeof picked === "string" && listVerticalSlugs().includes(picked)) {
        initialVertical = picked;
      }
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
    <main className="auth-wrap auth-wrap--top">
      <div className="auth-card auth-card--xwide">
        <div className="auth-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/korent-icon.svg" alt="" />
          <b>Korent</b>
        </div>

        <div className="eyebrow eyebrow--accent">{m.onboarding.kicker}</div>
        <h1 className="auth-title">{m.onboarding.title}</h1>
        <div className="auth-sub">{m.onboarding.description}</div>

        <OnboardingForm
          verticalOptions={buildVerticalOptions()}
          initialVertical={initialVertical}
        />

        <div className="auth-alt">
          <Link href="/login" className="ghost-btn">
            {m.onboarding.backToLogin}
          </Link>
        </div>
      </div>
    </main>
  );
}
