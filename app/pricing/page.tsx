import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { PricingGrid } from "@/components/public/pricing-grid";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Pricing — Korent",
  description:
    "Simple, transparent pricing for party rental businesses. Start your 14-day free trial today.",
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <>
      <PublicHeader />

      <main>
        <section className="section" style={{ paddingTop: 48, paddingBottom: 24 }}>
          <div className="container" style={{ textAlign: "center" }}>
            <div className="kicker">Simple, transparent pricing</div>
            <h1 style={{ margin: "8px 0 12px", fontSize: "clamp(2rem, 4vw, 3rem)" }}>
              One platform. Three plans.
            </h1>
            <p className="muted" style={{ maxWidth: "56ch", margin: "0 auto", fontSize: "1.05rem" }}>
              Start with a 14-day free trial on any plan. No credit card required.
              Scale up as your business grows.
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
            <h2 style={{ marginBottom: 12 }}>Every plan includes</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                marginTop: 24,
                textAlign: "left",
              }}
            >
              {[
                "Online customer storefront",
                "Order management",
                "Customer database",
                "Delivery scheduling",
                "Rental agreements",
                "Safety waivers",
                "Service area management",
                "Mobile crew dispatch",
                "Asset & maintenance tracking",
                "Email support",
              ].map((feature) => (
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
                Have questions? <Link href="/dashboard/help" style={{ color: "var(--primary)", fontWeight: 600 }}>Visit our help center</Link> or
                email us at support@korent.app
              </p>
            </div>
          </div>
        </section>

        <PublicFooter />
      </main>
    </>
  );
}
