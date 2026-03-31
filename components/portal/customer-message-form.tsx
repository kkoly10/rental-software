"use client";

import { useActionState } from "react";
import { sendCustomerMessage, type SendMessageState } from "@/lib/portal/send-message";

type Props = {
  orderNumber: string;
  email: string;
};

const SUBJECTS = [
  "Question about my order",
  "Request to reschedule",
  "Request to cancel",
  "Other",
];

export function CustomerMessageForm({ orderNumber, email }: Props) {
  const [state, formAction, pending] = useActionState<SendMessageState, FormData>(
    sendCustomerMessage,
    { ok: true, message: "" }
  );

  if (state.ok && state.message && state.message.includes("sent")) {
    return (
      <div className="panel" style={{ marginTop: 16 }}>
        <div className="section-header">
          <h3 style={{ margin: 0 }}>Contact us</h3>
        </div>
        <div className="badge success" style={{ marginTop: 12 }}>{state.message}</div>
      </div>
    );
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="section-header">
        <h3 style={{ margin: 0 }}>Contact us</h3>
      </div>

      <form action={formAction} className="portal-message-form">
        <input type="hidden" name="order_number" value={orderNumber} />
        <input type="hidden" name="email" value={email} />

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Subject</span>
          <select name="subject" required>
            <option value="">Select a subject...</option>
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Message</span>
          <textarea
            name="message"
            placeholder="How can we help?"
            rows={4}
            required
            maxLength={2000}
          />
        </label>

        {!state.ok && state.message && (
          <div className="badge warning">{state.message}</div>
        )}

        <button type="submit" className="primary-btn" disabled={pending}>
          {pending ? "Sending..." : "Send Message"}
        </button>
      </form>
    </div>
  );
}
