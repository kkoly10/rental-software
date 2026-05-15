"use client";

import { useActionState, useEffect } from "react";
import { createBalancePaymentSession, type PayBalanceState } from "@/lib/portal/pay-balance";
import { useI18n } from "@/lib/i18n/provider";
import { formatMessage } from "@/lib/i18n/format";

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
  const { messages: m } = useI18n();

  useEffect(() => {
    if (state.ok && state.stripeUrl?.startsWith("https://checkout.stripe.com/")) {
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
          {pending
            ? m.portal.payBalance.preparing
            : formatMessage(m.portal.payBalance.payBalance, { amount: balanceDue })}
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
