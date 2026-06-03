"use client";

import { useActionState } from "react";
import {
  updateCustomerWhatsAppPreferences,
  sendWhatsAppOptInInvite,
  type CustomerActionState,
} from "@/lib/customers/actions";

const initial: CustomerActionState = { ok: false, message: "" };

/**
 * Sprint 4.5 — operator-facing toggle for the customer's WhatsApp
 * preferences. Mounted on the customer detail page below the address
 * card.
 *
 * Two inputs:
 *   - `whatsapp_opted_in` checkbox: whether the customer wants
 *     WhatsApp notifications instead of SMS where available
 *   - `whatsapp_number` text field: optional override when the
 *     WhatsApp number differs from the primary phone. Empty = fall
 *     back to phone.
 *
 * Customer-facing self-service opt-in (an SMS "Reply YES" flow that
 * lets the customer flip this themselves) is the next slice of
 * Sprint 4.5 — for now the operator toggles per customer based on
 * conversation. This already closes the immediate gap where the only
 * way to opt anyone in was via the SQL editor.
 */
export function WhatsAppPreferencesForm({
  customerId,
  defaults,
}: {
  customerId: string;
  defaults: { optedIn: boolean; whatsappNumber: string };
}) {
  const [state, action, pending] = useActionState(
    updateCustomerWhatsAppPreferences,
    initial,
  );

  // The "Save preferences" form and the "Send invite" form are
  // siblings, not nested — HTML forbids form-inside-form even though
  // React would render it. Each owns its own useActionState so
  // saving preferences doesn't clobber the invite feedback and vice
  // versa.
  return (
    <div className="stack-gap">
      <PreferencesForm
        customerId={customerId}
        defaults={defaults}
        state={state}
        action={action}
        pending={pending}
      />
      <InviteRow customerId={customerId} />
    </div>
  );
}

function PreferencesForm({
  customerId,
  defaults,
  state,
  action,
  pending,
}: {
  customerId: string;
  defaults: { optedIn: boolean; whatsappNumber: string };
  state: CustomerActionState;
  action: (formData: FormData) => void;
  pending: boolean;
}) {
  return (
    <form action={action} className="stack-gap">
      <input type="hidden" name="customer_id" value={customerId} />

      <label
        className="order-card"
        style={{ display: "flex", alignItems: "flex-start", gap: 12 }}
      >
        <input
          type="checkbox"
          name="whatsapp_opted_in"
          defaultChecked={defaults.optedIn}
          style={{ width: 20, height: 20, marginTop: 2 }}
        />
        <div style={{ flex: 1 }}>
          <strong>Send notifications over WhatsApp</strong>
          <div
            className="muted"
            style={{ fontSize: 13, marginTop: 4 }}
          >
            When on, this customer receives order confirmations and
            delivery updates via WhatsApp where a Meta-approved template
            exists. Falls back to SMS automatically when WhatsApp isn't
            available.
          </div>
        </div>
      </label>

      <label
        className="order-card"
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        <strong>WhatsApp number (optional)</strong>
        <div className="muted" style={{ fontSize: 13 }}>
          Only set this when the customer uses a different number on
          WhatsApp than their primary phone. Leave blank to use their
          phone number.
        </div>
        <input
          type="text"
          name="whatsapp_number"
          defaultValue={defaults.whatsappNumber}
          placeholder="+14155551234"
          style={{ maxWidth: 280 }}
        />
      </label>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="primary-btn" disabled={pending}>
          {pending ? "Saving…" : "Save WhatsApp preferences"}
        </button>
        {state.message && (
          <span
            className={state.ok ? "badge success" : "badge warning"}
            style={{ fontSize: 12, maxWidth: 380 }}
            role={state.ok ? undefined : "alert"}
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

/**
 * Sprint 4.5 next slice — operator-initiated "Send opt-in invite"
 * action that texts the customer a one-tap prompt. Sits inside the
 * same form's <form> tag is technically nested, but the inner
 * `<form>` semantics around action attributes work fine in React 19
 * because each useActionState owns its own action target.
 *
 * Why a separate sub-component: this action has its own state that
 * shouldn't reset the parent form's state when fired. Keeping it
 * scoped lets the operator save preferences AND send an invite
 * without each click clobbering the other's feedback message.
 */
function InviteRow({ customerId }: { customerId: string }) {
  const [state, action, pending] = useActionState(
    sendWhatsAppOptInInvite,
    initial,
  );
  return (
    <form
      action={action}
      style={{
        marginTop: 8,
        padding: 12,
        borderTop: "1px solid var(--border)",
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <input type="hidden" name="customer_id" value={customerId} />
      <div style={{ flex: "1 1 280px", minWidth: 220 }}>
        <strong style={{ fontSize: 13 }}>Customer self-opt-in</strong>
        <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
          Sends a one-line SMS asking the customer to reply WHATSAPP to opt
          in. They can also reply WA STOP later to opt back out.
        </div>
      </div>
      <button
        type="submit"
        className="ghost-btn"
        disabled={pending}
        style={{ fontSize: 13 }}
      >
        {pending ? "Sending…" : "Send invite SMS"}
      </button>
      {state.message && (
        <div
          className={state.ok ? "badge success" : "badge warning"}
          style={{ fontSize: 12, flexBasis: "100%" }}
          role={state.ok ? undefined : "alert"}
        >
          {state.message}
        </div>
      )}
    </form>
  );
}
