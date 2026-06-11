"use client";

import { useActionState } from "react";
import { submitSupportRequest, type SupportState } from "@/lib/market/support-actions";

const initial: SupportState = { ok: false, message: "" };
const field: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid var(--mk-line, #f0e4d8)",
  borderRadius: 10,
  font: "inherit",
  marginTop: 4,
};
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, display: "block", marginTop: 12 };

export function SupportForm({ defaultEmail }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState(submitSupportRequest, initial);

  if (state.ok) {
    return <p className="mk-msg ok">✓ {state.message}</p>;
  }

  return (
    <form action={action}>
      <label style={{ ...label, marginTop: 0 }}>
        Your email
        <input type="email" name="email" required defaultValue={defaultEmail ?? ""} style={field} />
      </label>
      <label style={label}>
        Topic
        <select name="topic" required defaultValue="booking" style={field}>
          <option value="booking">A booking</option>
          <option value="payment">A payment or deposit</option>
          <option value="listing">A listing</option>
          <option value="account">My account / verification</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label style={label}>
        What's going on?
        <textarea name="message" required minLength={10} maxLength={2000} rows={5} style={field} />
      </label>
      <button type="submit" className="mk-btn" style={{ width: "100%", marginTop: 14 }} disabled={pending}>
        {pending ? "Sending…" : "Send to support"}
      </button>
      {state.message ? <p className="mk-msg err">{state.message}</p> : null}
    </form>
  );
}
