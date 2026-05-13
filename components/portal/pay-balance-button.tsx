"use client";

import { useActionState, useEffect } from "react";
import { createBalancePaymentSession, type PayBalanceState } from "@/lib/portal/pay-balance";

const initial: PayBalanceState = { ok: false, message: "" };

export function PayBalanceButton({
  portalToken,
  balanceDue,
}: {
  portalToken: string;
  balanceDue: string;
}) {
  const balance = parseFloat(balanceDue.replace(/[^0-9.]/g, ""));
  const [state, action, pending] = useActionState(createBalancePaymentSession, initial);

  useEffect(() => {
    if (state.ok && state.stripeUrl) {
      window.location.href = state.stripeUrl;
    }
  }, [state.ok, state.stripeUrl]);

  if (balance <= 0) return null;

  return (
    <div>
      <form action={action}>
        <input type="hidden" name="portal_token" value={portalToken} />
        <button
          type="submit"
          className="primary-btn"
          disabled={pending}
          style={{ fontWeight: 600 }}
        >
          {pending ? "Preparing payment…" : `Pay balance ${balanceDue}`}
        </button>
      </form>
      {state.message && !state.ok && (
        <div className="badge warning" style={{ marginTop: 8, fontSize: 12 }}>
          {state.message}
        </div>
      )}
    </div>
  );
}
