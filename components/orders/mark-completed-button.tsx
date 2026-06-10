"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/lib/orders/actions";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Tier-1 launch fix — close out a delivered order. The state machine
 * has allowed `delivered → completed` since day one, but no surface
 * ever exposed it, so orders piled up at `delivered` forever.
 *
 * Two-step confirm per Decision 2.2 (lib/orders/actions.ts:868):
 * the first click arms the button, the second fires the transition.
 * Mirrors the crew app's mis-tap guard rather than a modal — same
 * pattern the rest of the codebase uses for irreversible-ish moves.
 */
const ALLOWED_FROM = new Set(["delivered"]);

export function MarkCompletedButton({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [armed, setArmed] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const { messages: m } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (result?.ok) router.refresh();
  }, [result?.ok, router]);

  const normalized = currentStatus.toLowerCase().replace(/\s+/g, "_");
  if (!ALLOWED_FROM.has(normalized)) {
    return null;
  }

  function handleClick() {
    if (!armed) {
      setArmed(true);
      return;
    }
    startTransition(async () => {
      const res = await updateOrderStatus(orderId, "completed");
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
        className={armed ? "primary-btn" : "secondary-btn"}
        onClick={handleClick}
        disabled={isPending}
        style={{ fontSize: 13 }}
      >
        {isPending
          ? m.dashboard.orders.detail.completingOrder
          : armed
          ? m.dashboard.orders.detail.confirmCompleteCta
          : m.dashboard.orders.detail.markCompletedCta}
      </button>
      {armed && !isPending && (
        <span className="muted" style={{ fontSize: 12 }}>
          {m.dashboard.orders.detail.completeHint}
        </span>
      )}
      {result && !result.ok && (
        <span className="badge warning" style={{ fontSize: 12 }} role="alert">
          {result.message}
        </span>
      )}
    </div>
  );
}
