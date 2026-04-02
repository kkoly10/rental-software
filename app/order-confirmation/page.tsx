import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { buildPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Order Confirmed",
  description: "Your rental booking has been submitted successfully.",
  path: "/order-confirmation",
});

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; status?: string }>;
}) {
  const { order, status } = await searchParams;
  const isPaid = status === "paid";

  return (
    <>
      <PublicHeader />

      <main className="page">
        <div className="container" style={{ maxWidth: 640 }}>
          <section className="panel" style={{ padding: "40px 36px", textAlign: "center" }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: isPaid ? "var(--accent)" : "var(--primary)",
                color: "white",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
              aria-hidden="true"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <div className="kicker">
              {isPaid ? "Payment received" : "Booking submitted"}
            </div>
            <h1 style={{ margin: "8px 0 12px" }}>
              {isPaid ? "You're all set!" : "Thank you for your booking!"}
            </h1>

            {order && (
              <div
                style={{
                  display: "inline-block",
                  padding: "8px 18px",
                  background: "var(--surface-muted)",
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  marginBottom: 16,
                }}
              >
                Order {order}
              </div>
            )}

            <p className="muted" style={{ maxWidth: 440, margin: "0 auto 24px" }}>
              {isPaid
                ? "Your deposit has been received. We'll confirm your delivery details and send you an agreement shortly."
                : "Your order has been created. The operator will contact you about payment and confirm delivery details."}
            </p>

            <div className="list" style={{ textAlign: "left", marginBottom: 24 }}>
              <div className="order-card">
                <strong>What happens next</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  Our team will review your booking, confirm the event date, and send you setup and safety details.
                </div>
              </div>
              <div className="order-card">
                <strong>Track your order</strong>
                <div className="muted" style={{ marginTop: 6 }}>
                  Use your order number and email to check status, view documents, and message the operator.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/order-status" className="primary-btn">
                Check Order Status
              </Link>
              <Link href="/inventory" className="secondary-btn">
                Browse More Rentals
              </Link>
              <Link href="/" className="ghost-btn">
                Back to Home
              </Link>
            </div>
          </section>
        </div>
      </main>

      <PublicFooter />
    </>
  );
}
