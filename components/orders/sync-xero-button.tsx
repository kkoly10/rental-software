"use client";

import { useActionState } from "react";
import { manualSyncOrderToXero } from "@/lib/integrations/xero/actions";
import type { XeroSyncActionState } from "@/lib/integrations/xero/actions";

const initial: XeroSyncActionState = { ok: false, message: "" };

export function SyncXeroButton({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(manualSyncOrderToXero, initial);
  return (
    <form action={formAction} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <input type="hidden" name="order_id" value={orderId} />
      <button type="submit" className="ghost-btn" style={{ fontSize: 13 }} disabled={pending}>
        {pending ? "Syncing…" : "Sync to Xero"}
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
