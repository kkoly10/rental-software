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

  return buildPageMetadata({
    title: productName
      ? `${productName} Checkout | ${settings.businessName}`
      : `Checkout | ${settings.businessName}`,
    description: productName
      ? `Complete your booking request for ${productName} with ${settings.businessName}.`
      : `Complete your inflatable rental booking request with ${settings.businessName}.`,
    path: "/checkout",
  });
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string; date?: string; zip?: string }>;
}) {
  await requirePublicOrg();
  const isDemo = await isCurrentTenantDemo();

  const { product, date, zip } = await searchParams;
  const productName = formatProductName(product);

  const [pricing, policies] = await Promise.all([
    getCheckoutPricing(product, zip),
    getBookingPolicies(),
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
              <span className="storefront-context-pill">Rental: {productName}</span>
            ) : null}
            {date ? <span className="storefront-context-pill">Date: {date}</span> : null}
            {zip ? <span className="storefront-context-pill">ZIP: {zip}</span> : null}
          </div>

          <div className="storefront-checkout-shell">
            <section className="panel">
              <div className="kicker">Checkout</div>
              <h1 style={{ margin: "8px 0 10px" }}>Complete your booking request</h1>
              <div className="muted">
                Enter your event and delivery details to reserve your inflatable.
                We will confirm availability, setup timing, and agreement details
                after submission.
              </div>

              <CheckoutForm
                productSlug={product}
                initialDate={date}
                initialZip={zip}
                minDate={minDate}
                maxDate={maxDate}
                cancellationPolicy={policies.cancellationPolicyText ?? undefined}
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
