import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { MultiItemCheckout } from "@/components/checkout/multi-item-checkout";
import { getBookingPolicies } from "@/lib/data/booking-policies";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { isCurrentTenantDemo } from "@/lib/demo/context";
import { DemoBanner } from "@/components/demo/demo-banner";

export async function generateMetadata(): Promise<Metadata> {
  return await buildPageMetadata({
    title: "Checkout",
    description: "Complete your combined rental booking.",
    path: "/cart/checkout",
  });
}

/**
 * Phase 3b — combined multi-item checkout page. The cart lives client-side
 * (localStorage), so the body is a client component that reads it via
 * useCart() and POSTs the whole cart as `cart_json` to createCheckoutOrder.
 * This page only supplies server-resolved booking-date constraints; the
 * single-item /checkout?product=… page is untouched.
 */
export default async function CartCheckoutPage() {
  await requirePublicOrg();
  const isDemo = await isCurrentTenantDemo();
  const policies = await getBookingPolicies();

  const now = new Date();
  const minDate = new Date(now.getTime() + policies.bookingLeadTimeHours * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const maxDate = new Date(now.getTime() + policies.maxAdvanceBookingDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <>
      <PublicHeader />
      <main className="page">
        <div className="container">
          <div className="storefront-checkout-shell">
            <MultiItemCheckout
              minDate={minDate}
              maxDate={maxDate}
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
