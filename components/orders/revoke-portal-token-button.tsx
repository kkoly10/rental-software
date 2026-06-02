"use client";

import { useActionState } from "react";
import { revokeOrderPortalToken, type OrderActionState } from "@/lib/orders/actions";

const initial: OrderActionState = { ok: false, message: "" };

export function RevokePortalTokenButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const [state, action, pending] = useActionState(revokeOrderPortalToken, initial);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const ok = window.confirm(
      `Revoke portal access for order #${orderNumber}?\n\n` +
        `Any /order-status link in the customer's email will stop working.\n` +
        `They can re-acquire access via order number + email lookup.`
    );
    if (!ok) e.preventDefault();
  }

  return (
    <form action={action} onSubmit={onSubmit} style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <input type="hidden" name="order_id" value={orderId} />
      <button
        type="submit"
        className="ghost-btn"
        disabled={pending}
        style={{ fontSize: 12, color: "var(--danger, #b91c1c)", borderColor: "var(--danger, #b91c1c)" }}
      >
        {pending ? "Revoking…" : "Revoke portal access"}
      </button>
      {state.message && (
        <div
          role={state.ok ? "status" : "alert"}
          aria-live={state.ok ? "polite" : "assertive"}
          className={state.ok ? "badge success" : "badge warning"}
          style={{ fontSize: 11, padding: "4px 8px" }}
        >
          {state.message}
        </div>
      )}
    </form>
  );
}
