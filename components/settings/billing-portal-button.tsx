"use client";

import { useActionState } from "react";
import { createBillingPortalSession } from "@/lib/stripe/actions";
import { useI18n } from "@/lib/i18n/provider";

export function BillingPortalButton() {
  const [state, formAction, pending] = useActionState(
    async () => {
      return await createBillingPortalSession();
    },
    { ok: true, message: "" }
  );
  const { messages: m } = useI18n();

  return (
    <form action={formAction}>
      <button
        type="submit"
        className="secondary-btn"
        disabled={pending}
        style={{ marginTop: 8 }}
      >
        {pending ? m.forms.billingPortal.opening : m.forms.billingPortal.manage}
      </button>
      {!state.ok && state.message && (
        <div className="badge warning" style={{ marginTop: 8 }}>
          {state.message}
        </div>
      )}
    </form>
  );
}
