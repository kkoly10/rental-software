"use client";

import { useState, useTransition } from "react";
import { updateOrderStatus } from "@/lib/orders/actions";

// Terminal statuses for which cancellation is either irrelevant or not allowed
// by the state machine in lib/orders/actions.ts. Hide the button instead of
// showing it as disabled — operators get no value from a "cancel" they can't use.
const TERMINAL_STATUSES = new Set(["cancelled", "completed", "refunded"]);

export function CancelOrderButton({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // The display labels coming from the page are title-cased ("Confirmed",
  // "Out for Delivery", etc.) — the action's state machine uses snake_case.
  const normalized = currentStatus.toLowerCase().replace(/\s+/g, "_");
  if (TERMINAL_STATUSES.has(normalized)) return null;

  function handleClick() {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Cancel this order? Inventory will be released and the customer will be notified by email and SMS (if opted in)."
      );
      if (!confirmed) return;
    }
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, "cancelled");
      setResult(res);
    });
  }

  if (result?.ok) {
    return (
      <span className="badge success" style={{ fontSize: 12 }}>
        {result.message}
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <button
        type="button"
        className="ghost-btn"
        onClick={handleClick}
        disabled={isPending}
        style={{ fontSize: 13, color: "var(--danger, #b91c1c)", borderColor: "var(--danger, #b91c1c)" }}
      >
        {isPending ? "Cancelling…" : "Cancel order"}
      </button>
      {result && !result.ok && (
        <span className="badge warning" style={{ fontSize: 12 }} role="alert">
          {result.message}
        </span>
      )}
    </div>
  );
}
