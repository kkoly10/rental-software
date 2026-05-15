"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Dashboard-wide banner shown when an operator's subscription needs attention.
 * Rendered inside DashboardShell so it appears on every dashboard page.
 */
export function SubscriptionBanner({
  status,
}: {
  status: string | null | undefined;
}) {
  const { messages } = useI18n();
  const m = messages.forms.subscriptionBanner;

  if (!status || !["past_due", "canceled", "unpaid"].includes(status)) {
    return null;
  }

  const messageMap: Record<string, { text: string; tone: string }> = {
    past_due: {
      text: m.pastDue,
      tone: "var(--warning, #e6a817)",
    },
    canceled: {
      text: m.canceled,
      tone: "var(--danger, #dc3545)",
    },
    unpaid: {
      text: m.unpaid,
      tone: "var(--danger, #dc3545)",
    },
  };

  const msg = messageMap[status];
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
        {m.manageBilling}
      </Link>
    </div>
  );
}
