"use client";

import { useActionState } from "react";
import { cancelOrderFromPortal, type CancelOrderState } from "@/lib/portal/cancel-order";

const initial: CancelOrderState = { ok: false, message: "" };

// The portal's lookup output uses title-cased status labels ("Confirmed",
// "Quote Sent", etc.); the snake_case statuses live in the DB / action. Mirror
// the allowlist in the cancel action so the button is hidden whenever the
// action would reject anyway.
const TITLE_CASED_CANCELLABLE = new Set([
  "Inquiry",
  "Quote Sent",
  "Awaiting Deposit",
  "Confirmed",
]);

export function CancelBookingButton({
  portalToken,
  currentStatus,
}: {
  portalToken: string;
  currentStatus: string;
}) {
  const [state, action, pending] = useActionState(cancelOrderFromPortal, initial);

  if (!TITLE_CASED_CANCELLABLE.has(currentStatus)) return null;

  if (state.ok) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="badge success"
        style={{ padding: "10px 14px", fontSize: 13 }}
      >
        {state.message}
      </div>
    );
  }

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (typeof window !== "undefined") {
          const ok = window.confirm(
            "Cancel this booking? This will release the date and we'll email you a confirmation."
          );
          if (!ok) e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="portal_token" value={portalToken} />
      <button
        type="submit"
        className="ghost-btn"
        disabled={pending}
        style={{
          fontSize: 13,
          color: "var(--danger, #b91c1c)",
          borderColor: "var(--danger, #b91c1c)",
        }}
      >
        {pending ? "Cancelling…" : "Cancel booking"}
      </button>
      {state.message && !state.ok && (
        <div className="badge warning" role="alert" style={{ marginTop: 8, fontSize: 12 }}>
          {state.message}
        </div>
      )}
    </form>
  );
}
