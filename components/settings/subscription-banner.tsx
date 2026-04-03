"use client";

import Link from "next/link";

/**
 * Dashboard-wide banner shown when an operator's subscription needs attention.
 * Rendered inside DashboardShell so it appears on every dashboard page.
 */
export function SubscriptionBanner({
  status,
}: {
  status: string | null | undefined;
}) {
  if (!status || !["past_due", "canceled", "unpaid"].includes(status)) {
    return null;
  }

  const messages: Record<string, { text: string; tone: string }> = {
    past_due: {
      text: "Your subscription payment is past due. Update your payment method to avoid losing access.",
      tone: "var(--warning, #e6a817)",
    },
    canceled: {
      text: "Your subscription has been canceled. Resubscribe to keep your storefront active and access all features.",
      tone: "var(--danger, #dc3545)",
    },
    unpaid: {
      text: "Your subscription payment failed. Please update your payment method.",
      tone: "var(--danger, #dc3545)",
    },
  };

  const msg = messages[status];
  if (!msg) return null;

  return (
    <div
      role="alert"
      style={{
        background: msg.tone,
        color: "white",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        fontSize: "0.9rem",
        flexWrap: "wrap",
      }}
    >
      <span>{msg.text}</span>
      <Link
        href="/dashboard/settings/billing"
        style={{
          color: "white",
          textDecoration: "underline",
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}
      >
        Manage Billing
      </Link>
    </div>
  );
}
