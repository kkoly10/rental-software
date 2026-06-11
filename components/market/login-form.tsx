"use client";

import { useActionState } from "react";
import { marketSignIn, type MarketSignInState } from "@/lib/market/support-actions";

const initial: MarketSignInState = { ok: false, message: "" };
const field: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  border: "1px solid var(--mk-line, #f0e4d8)",
  borderRadius: 10,
  font: "inherit",
  marginTop: 4,
};
const label: React.CSSProperties = { fontSize: 12, fontWeight: 700, display: "block", marginTop: 12 };

export function MarketLoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, action, pending] = useActionState(marketSignIn, initial);

  return (
    <form action={action}>
      <input type="hidden" name="redirect_to" value={redirectTo} />
      <label style={{ ...label, marginTop: 0 }}>
        Email
        <input type="email" name="email" required defaultValue={state.email ?? ""} style={field} autoComplete="email" />
      </label>
      <label style={label}>
        Password
        <input type="password" name="password" required style={field} autoComplete="current-password" />
      </label>
      <button type="submit" className="mk-btn" style={{ width: "100%", marginTop: 14 }} disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
      {state.message ? <p className="mk-msg err">{state.message}</p> : null}
      <p className="mk-card-m" style={{ marginTop: 10 }}>
        <a href="/forgot-password">Forgot password?</a>
      </p>
    </form>
  );
}
