"use client";

import { useActionState } from "react";
import { sendCustomerMessage, type SendMessageState } from "@/lib/portal/send-message";
import { useI18n } from "@/lib/i18n/provider";

type Props = {
  portalToken: string;
};

export function CustomerMessageForm({ portalToken }: Props) {
  const { messages: m } = useI18n();
  const [state, formAction, pending] = useActionState<SendMessageState, FormData>(
    sendCustomerMessage,
    { ok: true, message: "" }
  );

  const subjects = [
    m.portal.message.subjects.question,
    m.portal.message.subjects.reschedule,
    m.portal.message.subjects.cancel,
    m.portal.message.subjects.other,
  ];

  if (state.ok && state.message && state.message.includes("sent")) {
    return (
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="section-header">
          <h3 style={{ margin: 0 }}>{m.portal.message.contactUs}</h3>
        </div>
        <div className="badge success" style={{ marginTop: 12 }}>{state.message}</div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="section-header">
        <h3 style={{ margin: 0 }}>{m.portal.message.contactUs}</h3>
      </div>

      <form action={formAction} className="portal-message-form">
        <input type="hidden" name="portal_token" value={portalToken} />

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{m.portal.message.subject}</span>
          <select name="subject" required>
            <option value="">{m.portal.message.subjectPlaceholder}</option>
            {subjects.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{m.portal.message.message}</span>
          <textarea
            name="message"
            placeholder={m.portal.message.messagePlaceholder}
            rows={4}
            required
            maxLength={2000}
          />
        </label>

        {!state.ok && state.message && (
          <div className="badge warning">{state.message}</div>
        )}

        <button type="submit" className="primary-btn" disabled={pending}>
          {pending ? m.portal.message.sending : m.portal.message.submit}
        </button>
      </form>
    </div>
  );
}
