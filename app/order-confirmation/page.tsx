import type { Metadata } from "next";
import Link from "next/link";
import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { buildPageMetadata } from "@/lib/seo/metadata";
import { hasSupabaseEnv } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicOrgId } from "@/lib/auth/org-context";
import { getOrderFinancials } from "@/lib/payments/financials";
import { hasStripeEnv, getStripe } from "@/lib/stripe/config";
import { issuePortalAccessToken } from "@/lib/portal/access-token";

export const metadata: Metadata = buildPageMetadata({
  title: "Order Confirmed",
  description: "Your rental booking has been submitted successfully.",
  path: "/order-confirmation",
});

/**
 * Determine the real payment status for this order.
 *
 * SECURITY: Never trust URL params for payment status. Instead:
 *  1. If a Stripe session_id is present, verify via the Stripe API
 *  2. Check the database for actual payment records
 *  3. If the webhook hasn't fired yet, show "processing" instead of "paid"
 */
async function resolvePaymentStatus(
  orderNumber: string | undefined,
  sessionId: string | undefined
): Promise<{ status: "paid" | "processing" | "unpaid"; orderNumber: string | undefined }> {
  if (!hasSupabaseEnv() || !orderNumber) {
    return { status: "unpaid", orderNumber };
  }

  const orgId = await getPublicOrgId();
  if (!orgId) return { status: "unpaid", orderNumber };

  const supabase = await createSupabaseServerClient();

  // Look up the order in the database
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_status, total_amount")
    .eq("organization_id", orgId)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) return { status: "unpaid", orderNumber };

  // Check actual payment records via the financials utility
  const financials = await getOrderFinancials(order.id);

  if (financials && financials.totalPaid > 0 && financials.depositFulfilled) {
    // Database confirms payment was received (webhook has fired)
    return { status: "paid", orderNumber };
  }

  // If a Stripe checkout session ID was provided, verify with the Stripe API
  if (sessionId && hasStripeEnv()) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid") {
        // Stripe confirms payment, but our webhook may not have fired yet.
        // Show "processing" — the webhook will update the DB shortly.
        if (!financials || financials.totalPaid === 0) {
          return { status: "processing", orderNumber };
        }
        return { status: "paid", orderNumber };
      }
    } catch {
      // Session retrieval failed — fall through to unpaid
    }
  }

  // If the order status was already updated by a webhook (e.g. confirmed),
  // that implies payment was received
  if (order.order_status === "confirmed") {
    return { status: "paid", orderNumber };
  }

  return { status: "unpaid", orderNumber };
}


async function getPortalAccessUrl(orderNumber: string | undefined): Promise<string | null> {
  if (!hasSupabaseEnv() || !orderNumber) return null;

  const orgId = await getPublicOrgId();
  if (!orgId) return null;

  const supabase = await createSupabaseServerClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id")
    .eq("organization_id", orgId)
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (!order) return null;

  try {
    const token = await issuePortalAccessToken({ supabase, orderId: order.id });
    return `/order-status?token=${encodeURIComponent(token)}`;
  } catch {
    return null;
  }
}

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; status?: string; session_id?: string }>;
}) {
  const { order, session_id } = await searchParams;

  // Server-verified payment status — URL params are NOT trusted
  const { status } = await resolvePaymentStatus(order, session_id);
  const portalUrl = await getPortalAccessUrl(order);

  const isPaid = status === "paid";
  const isProcessing = status === "processing";

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
                background: isPaid
                  ? "var(--accent)"
                  : isProcessing
                  ? "var(--warning, #e6a817)"
                  : "var(--primary)",
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
              {isPaid
                ? "Payment confirmed"
                : isProcessing
                ? "Payment processing"
                : "Booking submitted"}
            </div>
            <h1 style={{ margin: "8px 0 12px" }}>
              {isPaid
                ? "You're all set!"
                : isProcessing
                ? "Almost there!"
                : "Thank you for your booking!"}
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
                : isProcessing
                ? "Your payment is being processed — you'll receive a confirmation email shortly. This usually takes just a moment."
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
                  Open your secure portal link to check status, view documents, and message the operator.
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href={portalUrl ?? "/order-status"} className="primary-btn">
                Open Customer Portal
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
