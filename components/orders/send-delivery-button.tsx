"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { dispatchOrderDelivery } from "@/lib/routes/dispatch";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Sprint 1.5 — one-click "Send delivery" button on the order detail
 * page. Wraps `dispatchOrderDelivery` which atomically flips:
 *   - the route stop to `en_route`
 *   - the parent route to `in_progress`
 *   - the order to `out_for_delivery`
 *
 * Visible from `confirmed` and `scheduled` only. We don't show it
 * earlier (the order isn't ready to dispatch) or later (it's already
 * out, delivered, or cancelled).
 */
const ALLOWED_FROM = new Set(["confirmed", "scheduled"]);

export function SendDeliveryButton({
  orderId,
  currentStatus,
  hasRouteStop = true,
}: {
  orderId: string;
  currentStatus: string;
  /**
   * Whether this order is already attached to a route. The dispatch RPC
   * returns `not_found` when no stop exists; rather than letting the
   * operator click and bounce off that error (Gap #3 from the launch
   * audit), we render a clear "Attach to a route first" CTA instead.
   * Defaults true so older call sites keep working.
   */
  hasRouteStop?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const { messages: m } = useI18n();
  const router = useRouter();

  // Refresh the order detail page so the status badge and the route
  // panel both reflect the new state after dispatch.
  useEffect(() => {
    if (result?.ok) router.refresh();
  }, [result?.ok, router]);

  const normalized = currentStatus.toLowerCase().replace(/\s+/g, "_");
  if (!ALLOWED_FROM.has(normalized) && !ALLOWED_FROM.has(currentStatus.toLowerCase())) {
    return null;
  }

  function handleClick() {
    startTransition(async () => {
      const form = new FormData();
      form.append("order_id", orderId);
      const res = await dispatchOrderDelivery(
        { ok: false, message: "" },
        form,
      );
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

  // No route stop yet → don't let the operator click into a confusing
  // "not_found" failure. Send them straight to the on-page assign card.
  if (!hasRouteStop) {
    return (
      <a
        href="#assign-to-route"
        className="secondary-btn"
        style={{ fontSize: 13 }}
      >
        {m.dashboard.orders.detail.attachToRouteFirstCta}
      </a>
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
          ? m.dashboard.orders.detail.dispatchingDelivery
          : m.dashboard.orders.detail.sendDeliveryCta}
      </button>
      {result && !result.ok && (
        <span className="badge warning" style={{ fontSize: 12 }} role="alert">
          {result.message}
        </span>
      )}
    </div>
  );
}
