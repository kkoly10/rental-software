import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { OrderLookupForm } from "@/components/portal/order-lookup-form";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Check Order Status",
  description: "Look up your rental order status, event details, and balance due.",
  path: "/order-status",
});

export default function OrderStatusPage() {
  return (
    <>
      <PublicHeader />

      <main className="page">
        <div className="container" style={{ maxWidth: 640 }}>
          <div style={{ textAlign: "center", marginBottom: 32 }}>
            <div className="kicker">Customer portal</div>
            <h1 style={{ margin: "8px 0 12px", fontSize: "clamp(1.8rem, 3vw, 2.5rem)" }}>
              Check your order status
            </h1>
            <p className="muted">
              Enter your order number and email to view your booking details,
              balance, and documents.
            </p>
          </div>

          <OrderLookupForm />
        </div>
      </main>

      <PublicFooter />
    </>
  );
}
