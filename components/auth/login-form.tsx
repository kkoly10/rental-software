"use client";

import { useActionState } from "react";
import { signInWithPassword } from "@/lib/auth/actions";

const initialState = {
  ok: false,
  message: "",
};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInWithPassword, initialState);

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <label className="order-card">
        <strong>Email</strong>
        <input name="email" type="email" placeholder="owner@business.com" style={{ marginTop: 10, width: "100%" }} />
      </label>

      <label className="order-card">
        <strong>Password</strong>
        <input name="password" type="password" placeholder="Enter password" style={{ marginTop: 10, width: "100%" }} />
      </label>

      {state.message ? <div className="muted">{state.message}</div> : null}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Signing In..." : "Sign In"}
        </button>
      </div>
    </form>
  );
}
