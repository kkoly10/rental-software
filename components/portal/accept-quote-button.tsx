"use client";

import { useActionState } from "react";
import { acceptQuote, type AcceptQuoteState } from "@/lib/portal/accept-quote";
import { useI18n } from "@/lib/i18n/provider";

const initial: AcceptQuoteState = { ok: false, message: "" };

export function AcceptQuoteButton({ portalToken }: { portalToken: string }) {
  const [state, action, pending] = useActionState(acceptQuote, initial);
  const { messages: m } = useI18n();

  if (state.ok && state.message) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="badge success" style={{ padding: "10px 14px", fontSize: 13 }}>
          {state.message}
        </div>
        <button
          type="button"
          className="primary-btn"
          onClick={() => window.location.reload()}
          style={{ fontSize: 13 }}
        >
          {m.portal.acceptQuote.continueToPayment}
        </button>
      </div>
    );
  }

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
          {pending ? m.portal.acceptQuote.processing : m.portal.acceptQuote.accept}
        </button>
      </form>
      {!state.ok && state.message && (
        <div className="badge warning" style={{ marginTop: 8, fontSize: 12 }}>
          {state.message}
        </div>
      )}
    </div>
  );
}
