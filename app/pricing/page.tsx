import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
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
  });
}

export default async function PricingPage() {
  if (await isTenantHost()) {
    redirect("/inventory");
  }
  const m = await getMessages();

  return (
    <>
      <PublicHeader />

      <main>
        <section className="section" style={{ paddingTop: 48, paddingBottom: 24 }}>
          <div className="container" style={{ textAlign: "center" }}>
            <div className="kicker">{m.pricing.title}</div>
            <h1 style={{ margin: "8px 0 12px", fontSize: "clamp(2rem, 4vw, 3rem)" }}>
              {m.pricing.onePlatform}
            </h1>
            <p className="muted" style={{ maxWidth: "56ch", margin: "0 auto", fontSize: "1.05rem" }}>
              {m.pricing.trialBlurb}
            </p>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0 }}>
          <div className="container">
            <PricingGrid />
          </div>
        </section>

        <section className="section" style={{ paddingTop: 0, paddingBottom: 48 }}>
          <div className="container" style={{ maxWidth: 720, textAlign: "center" }}>
            <h2 style={{ marginBottom: 12 }}>{m.pricing.everyPlan}</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                marginTop: 24,
                textAlign: "left",
              }}
            >
              {m.pricing.features.map((feature) => (
                <div
                  key={feature}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 12,
                    background: "#f4f7fb",
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  {feature}
                </div>
              ))}
            </div>

            <div style={{ marginTop: 40 }}>
              <p className="muted">
                {m.pricing.haveQuestions}{" "}
                <a href="mailto:support@korent.app" style={{ color: "var(--primary)", fontWeight: 600 }}>
                  {m.pricing.emailUs}
                </a>
              </p>
            </div>
          </div>
        </section>

        <PublicFooter />
      </main>
    </>
  );
}
