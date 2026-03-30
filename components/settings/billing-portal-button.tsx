"use client";

import { useActionState } from "react";
import { createBillingPortalSession } from "@/lib/stripe/actions";

export function BillingPortalButton() {
  const [state, formAction, pending] = useActionState(
    async () => {
      return await createBillingPortalSession();
    },
    { ok: true, message: "" }
  );

  return (
    <form action={formAction}>
      <button
        type="submit"
        className="secondary-btn"
        disabled={pending}
        style={{ marginTop: 8 }}
      >
        {pending ? "Opening..." : "Manage Billing & Payment Method"}
      </button>
      {!state.ok && state.message && (
        <div className="badge warning" style={{ marginTop: 8 }}>
          {state.message}
        </div>
      )}
    </form>
  );
}
