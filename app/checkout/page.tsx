import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { CheckoutSummaryCard } from "@/components/checkout/checkout-summary-card";
import { getOrganizationSettings } from "@/lib/data/organization-settings";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { DemoBanner } from "@/components/demo/demo-banner";
import { isCurrentTenantDemo } from "@/lib/demo/context";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { getCheckoutPricing } from "@/lib/data/checkout-pricing";
import { getBookingPolicies } from "@/lib/data/booking-policies";
import { hasStripeEnv } from "@/lib/stripe/config";
import { getTranslator } from "@/lib/i18n/server";

function formatProductName(value?: string) {
  if (!value) return undefined;
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; date?: string; zip?: string }>;
}): Promise<Metadata> {
  const { product } = await searchParams;
  const settings = await getOrganizationSettings();
  const productName = formatProductName(product);

  return await buildPageMetadata({
    title: productName
      ? `${productName} Checkout | ${settings.businessName}`
      : `Checkout | ${settings.businessName}`,
    description: productName
      ? `Complete your booking request for ${productName} with ${settings.businessName}.`
      : `Complete your rental booking request with ${settings.businessName}.`,
    path: "/checkout",
    siteName: settings.businessName,
  });
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; date?: string; zip?: string; mode?: string; rentalEnd?: string; units?: string; variant?: string }>;
}) {
  await requirePublicOrg();
  const isDemo = await isCurrentTenantDemo();

  const { product, date, zip, mode, rentalEnd, units, variant } = await searchParams;
  const productName = formatProductName(product);
  // Sprint 6.0 — passed in from the product-detail Book Now CTA when
  // the customer picked wet/dry. The action validates against the
  // product's supports_modes before applying any upcharge.
  const selectedMode = mode === "wet" || mode === "dry" ? mode : undefined;

  const [pricing, policies, settings, { messages: m, t }] = await Promise.all([
    getCheckoutPricing(product, zip, date, selectedMode, rentalEnd),
    getBookingPolicies(),
    getOrganizationSettings(),
    getTranslator(),
  ]);
  const stripeEnabled = hasStripeEnv();

  // Compute date constraints from booking policies
  const now = new Date();
  const minDate = new Date(now.getTime() + policies.bookingLeadTimeHours * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const maxDate = new Date(now.getTime() + policies.maxAdvanceBookingDays * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);

  return (
    <>
      <PublicHeader />

      <main className="page">
        <div className="container">
          <div className="storefront-context-pills" style={{ marginBottom: 18 }}>
            {productName ? (
              <span className="storefront-context-pill">{t(m.checkout.pillRental, { value: productName })}</span>
            ) : null}
            {date ? <span className="storefront-context-pill">{t(m.checkout.pillDate, { value: date })}</span> : null}
            {zip ? <span className="storefront-context-pill">{t(m.checkout.pillZip, { value: zip })}</span> : null}
          </div>

          <div className="storefront-checkout-shell">
            <section className="panel">
              <div className="kicker">{m.checkout.kicker}</div>
              <h1 style={{ margin: "8px 0 10px" }}>{m.checkout.title}</h1>
              <div className="muted">
                {m.checkout.description}
              </div>

              {settings.bookingMessage && (
                <div className="order-card" style={{ marginTop: 16, background: "var(--primary-bg)", borderColor: "var(--border)" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 16 }}>ℹ️</span>
                    <span className="muted" style={{ fontSize: 14 }}>{settings.bookingMessage}</span>
                  </div>
                </div>
              )}

              <CheckoutForm
                productSlug={product}
                initialDate={date}
                initialZip={zip}
                minDate={minDate}
                maxDate={maxDate}
                cancellationPolicy={policies.cancellationPolicyText ?? undefined}
                selectedMode={selectedMode}
                initialUnits={units}
                selectedVariantId={variant}
              />
            </section>

            <CheckoutSummaryCard
              productName={productName}
              pricing={pricing ?? undefined}
              stripeEnabled={stripeEnabled}
              cancellationPolicy={policies.cancellationPolicyText ?? undefined}
            />
          </div>
        </div>
      </main>

      <PublicFooter />
      {isDemo && <DemoBanner />}
    </>
  );
}
