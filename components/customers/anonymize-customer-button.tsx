"use client";

import { useActionState } from "react";
import {
  anonymizeAndDeleteCustomer,
  type CustomerActionState,
} from "@/lib/customers/actions";

const initial: CustomerActionState = { ok: false, message: "" };

export function AnonymizeCustomerButton({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const [state, action, pending] = useActionState(anonymizeAndDeleteCustomer, initial);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    // GDPR erasure is irreversible — the row is anonymised in place, not
    // copied to a recoverable "deleted" table. Guard with a confirm dialog
    // including the customer's name so an operator clicking the wrong row
    // has one more chance to back out.
    const ok = window.confirm(
      `Delete and anonymize ${customerName}?\n\n` +
        `Their name, email, phone, and notes will be removed.\n` +
        `Order history is preserved for accounting.\n` +
        `This cannot be undone.`
    );
    if (!ok) e.preventDefault();
  }

  return (
    <form action={action} onSubmit={onSubmit} style={{ marginTop: 12 }}>
      <input type="hidden" name="customer_id" value={customerId} />
      <button
        type="submit"
        className="ghost-btn"
        disabled={pending}
        style={{
          color: "var(--danger, #b91c1c)",
          borderColor: "var(--danger, #b91c1c)",
          fontSize: 13,
        }}
      >
        {pending ? "Deleting…" : "Delete and anonymize"}
      </button>
      {state.message && !state.ok && (
        <div
          role="alert"
          aria-live="assertive"
          className="badge warning"
          style={{ marginTop: 8, fontSize: 12 }}
        >
          {state.message}
        </div>
      )}
    </form>
  );
}
