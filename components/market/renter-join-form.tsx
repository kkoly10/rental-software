"use client";

import { useActionState } from "react";
import { renterSignUp, type RenterSignupState } from "@/lib/market/renter-auth-actions";

const initial: RenterSignupState = { ok: false, message: "" };

const field: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid var(--mk-line, #f0e4d8)",
  borderRadius: 10,
  font: "inherit",
  marginTop: 4,
};
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, display: "block", marginTop: 12 };

export function RenterJoinForm() {
  const [state, action, pending] = useActionState(renterSignUp, initial);

  if (state.ok) {
    return <p className="mk-msg ok">✓ {state.message}</p>;
  }

  return (
    <form action={action}>
      <label style={{ ...label, marginTop: 0 }}>
        Full name
        <input name="full_name" required maxLength={100} style={field} autoComplete="name" />
      </label>
      <label style={label}>
        Email
        <input type="email" name="email" required defaultValue={state.email ?? ""} style={field} autoComplete="email" />
      </label>
      <label style={label}>
        Password (8+ characters)
        <input type="password" name="password" required minLength={8} maxLength={72} style={field} autoComplete="new-password" />
      </label>
      <label style={{ fontSize: 12, display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14 }}>
        <input type="checkbox" name="terms_accepted" required />
        <span>
          I agree to the <a href="/terms" target="_blank">terms</a> and{" "}
          <a href="/privacy" target="_blank">privacy policy</a>.
        </span>
      </label>
      <button type="submit" className="mk-btn" style={{ width: "100%", marginTop: 14 }} disabled={pending}>
        {pending ? "Creating…" : "Create account"}
      </button>
      {state.message ? <p className="mk-msg err">{state.message}</p> : null}
    </form>
  );
}
