import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MarketingHeader } from "@/components/marketing/marketing-header";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { PricingGrid } from "@/components/public/pricing-grid";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { isTenantHost } from "@/lib/auth/org-context";
import { getMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  return await buildPageMetadata({
    title: "Pricing — Korent",
    description:
      "Simple, transparent pricing for party rental businesses. Start your 14-day free trial today.",
    path: "/pricing",
    image: "/og-image.png",
  });
}

/**
 * Root-domain pricing page — mk-page marketing chrome (the previous
 * version rendered with the TENANT storefront header/footer, leaking
 * "Serving your service area" chrome onto Korent's own marketing
 * surface). Plan data stays on PricingGrid → PLAN_TIERS, the Stripe
 * source of truth, with the monthly/yearly toggle.
 */
export default async function PricingPage() {
  if (await isTenantHost()) {
    redirect("/inventory");
  }
  const m = await getMessages();
  const s = m.saasLanding;

  return (
    <div className="mk-page">
      <MarketingHeader
        navLinks={[
          { key: "why_korent", label: s.nav.whyKorent, href: "/#pain" },
          { key: "features", label: s.nav.features, href: "/#features" },
          { key: "faq", label: s.nav.faq, href: "/#faq" },
        ]}
      />

      <main>
        {/* ── Hero — text-led, editorial ─────────────────────────── */}
        <section className="mk-section--tight" style={{ paddingTop: 72 }}>
          <div className="mk-container" style={{ textAlign: "center" }}>
            <span className="mk-eyebrow">{m.pricing.title}</span>
            <h1>{m.pricing.onePlatform}</h1>
            <p className="mk-lede" style={{ maxWidth: "52ch", margin: "16px auto 0" }}>
              {m.pricing.trialBlurb}
            </p>
          </div>
        </section>

        {/* ── Plans — live PLAN_TIERS data + monthly/yearly toggle ── */}
        <section className="mk-section--tight" style={{ paddingTop: 8 }}>
          <div className="mk-container">
            <PricingGrid />
            <div className="mk-trust-strip-inner" style={{ marginTop: 28, padding: 0 }}>
              {s.pricingSection.trustSignals.map((signal) => (
                <span key={signal}>{signal}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Every plan includes ────────────────────────────────── */}
        <section className="mk-band">
          <div className="mk-section--tight">
            <div className="mk-container mk-container--mid">
              <div className="mk-section-head" style={{ marginBottom: 36 }}>
                <h2>{m.pricing.everyPlan}</h2>
              </div>
              <ul className="mk-checklist">
                {m.pricing.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <p className="mk-muted" style={{ textAlign: "center", margin: "32px 0 0" }}>
                {m.pricing.haveQuestions}{" "}
                <a href="mailto:support@korent.app" className="mk-text-link">
                  {m.pricing.emailUs}
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* ── Closing CTA ────────────────────────────────────────── */}
        <section className="mk-closing">
          <h2>{s.finalCta.title}</h2>
          <p className="mk-lede">{s.finalCta.subtitle}</p>
          <Link href="/signup" className="mk-btn mk-btn--accent mk-btn--lg">
            {s.finalCta.ctaPrimary}
          </Link>
          <p className="mk-closing-trust">{s.finalCta.trustLine}</p>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
