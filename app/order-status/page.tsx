import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { OrderLookupForm } from "@/components/portal/order-lookup-form";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { requirePublicOrg } from "@/lib/auth/require-public-org";
import { lookupOrderByPortalToken } from "@/lib/portal/lookup";

export const metadata: Metadata = buildPageMetadata({
  title: "Check Order Status",
  description: "View your rental order, documents, and balance through your secure portal link.",
  path: "/order-status",
});

export default async function OrderStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await requirePublicOrg();

  const { token } = await searchParams;
  const initialState = token ? await lookupOrderByPortalToken(token) : undefined;

  return (
    <>
      <PublicHeader />

      <main className="page">
        <div className="container" style={{ maxWidth: 680 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div className="kicker">Customer portal</div>
            <h1 style={{ margin: "8px 0 12px", fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>
              Check your order status
            </h1>
            <p className="muted">
              Open your secure portal link to view booking details, balance,
              and documents. If needed, you can request access with order number + email.
            </p>
          </div>

          <OrderLookupForm initialState={initialState} />
        </div>
      </main>

      <PublicFooter />
    </>
  );
}
