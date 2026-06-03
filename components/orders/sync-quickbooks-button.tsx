"use client";

import { useActionState } from "react";
import { manualSyncOrderToQuickBooks } from "@/lib/integrations/quickbooks/actions";
import type { SyncActionState } from "@/lib/integrations/quickbooks/actions";

const initial: SyncActionState = { ok: false, message: "" };

/**
 * Sprint 2 — order-page button that triggers a manual QBO sync.
 *
 * Visible whenever a QBO connection exists for the org. The auto-sync
 * runs when orders hit `delivered`, but operators commonly want to
 * confirm the integration works before they trust it — this button is
 * the safety valve for "test it on a real order."
 */
export function SyncQuickBooksButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(
    manualSyncOrderToQuickBooks,
    initial,
  );

  return (
    <form action={formAction} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <input type="hidden" name="order_id" value={orderId} />
      <button
        type="submit"
        className="ghost-btn"
        style={{ fontSize: 13 }}
        disabled={pending}
      >
        {pending ? "Syncing…" : "Sync to QuickBooks"}
      </button>
      {state.message && (
        <span
          className={state.ok ? "badge success" : "badge warning"}
          style={{ fontSize: 12 }}
          role={state.ok ? undefined : "alert"}
        >
          {state.message}
        </span>
      )}
    </form>
  );
}
