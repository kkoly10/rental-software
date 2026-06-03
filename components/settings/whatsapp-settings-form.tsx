"use client";

import { useActionState } from "react";
import { updateWhatsAppSettings } from "@/lib/settings/whatsapp-actions";
import type { WhatsAppSettings } from "@/lib/data/whatsapp-settings";
import type { WhatsAppSettingsState } from "@/lib/settings/whatsapp-actions";

const initial: WhatsAppSettingsState = { ok: false, message: "" };

/**
 * Sprint 4 — Settings → WhatsApp section.
 *
 * Two inputs:
 *   - `enabled` toggle (default off)
 *   - `sender_id` text field for the Twilio WhatsApp sender (E.164,
 *     with or without the leading "whatsapp:" — the action strips it)
 *
 * Visible everywhere; the action surface is gated to owner/admin
 * server-side. The form is intentionally simple — there's no
 * per-template approval UI yet (Sprint 4.5 follow-up).
 */
export function WhatsAppSettingsForm({ defaults }: { defaults: WhatsAppSettings }) {
  const [state, formAction, pending] = useActionState(
    updateWhatsAppSettings,
    initial,
  );

  return (
    <form action={formAction} className="stack-gap">
      <label
        className="order-card"
        style={{ display: "flex", alignItems: "center", gap: 12 }}
      >
        <input
          type="checkbox"
          name="enabled"
          defaultChecked={defaults.enabled}
          style={{ width: 20, height: 20 }}
        />
        <div>
          <strong>Enable WhatsApp notifications</strong>
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Send order confirmations, deposit reminders, and delivery
            updates over WhatsApp to customers who opt in. Falls back to
            SMS for everyone else.
          </div>
        </div>
      </label>

      <label
        className="order-card"
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        <strong>WhatsApp sender number</strong>
        <div className="muted" style={{ fontSize: 13 }}>
          The Twilio WhatsApp Business sender. Use the sandbox number
          (typically <code>+14155238886</code>) until your production
          sender is approved by Meta.
        </div>
        <input
          type="text"
          name="sender_id"
          defaultValue={defaults.senderId}
          placeholder="+14155238886"
          style={{ maxWidth: 280 }}
        />
      </label>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button type="submit" className="primary-btn" disabled={pending}>
          {pending ? "Saving…" : "Save WhatsApp settings"}
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
      </div>
    </form>
  );
}
