"use client";

import { useState, useTransition } from "react";
import { updateOrderStatus } from "@/lib/orders/actions";
import { useI18n } from "@/lib/i18n/provider";

// Statuses from which a forward transition to "confirmed" is allowed by
// the state machine in lib/orders/actions.ts.  Anything else: hide the
// button so the operator doesn't see an action they can't take.
const ALLOWED_FROM = new Set([
  "inquiry",
  "quote sent",
  "quote_sent",
  "awaiting deposit",
  "awaiting_deposit",
]);

export function ConfirmOrderButton({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null
  );
  const { messages: m } = useI18n();

  // The display labels coming from the page are title-cased ("Inquiry",
  // "Quote Sent", "Awaiting Deposit") — normalise to the canonical
  // snake_case the action checks.
  const normalized = currentStatus.toLowerCase().replace(/\s+/g, "_");
  if (!ALLOWED_FROM.has(normalized) && !ALLOWED_FROM.has(currentStatus.toLowerCase())) {
    return null;
  }

  function handleClick() {
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, "confirmed");
      setResult(res);
    });
  }

  if (result?.ok) {
    // The auto-attach hook in updateOrderStatus may append "Added to
    // route \"…\"." to the message — surface that to the operator so
    // they see the auto-route side effect, not just "Order status
    // updated to confirmed."
    return (
      <span className="badge success" style={{ fontSize: 12 }}>
        {result.message}
      </span>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        alignItems: "flex-start",
      }}
    >
      <button
        type="button"
        className="primary-btn"
        onClick={handleClick}
        disabled={isPending}
        style={{ fontSize: 13 }}
      >
        {isPending
          ? m.dashboard.orders.detail.confirmingOrder
          : m.dashboard.orders.detail.confirmOrderCta}
      </button>
      {result && !result.ok && (
        <span className="badge warning" style={{ fontSize: 12 }} role="alert">
          {result.message}
        </span>
      )}
    </div>
  );
}
