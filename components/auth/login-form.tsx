"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithPassword } from "@/lib/auth/actions";

const initialState = {
  ok: false,
  message: "",
};

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, pending] = useActionState(
    signInWithPassword,
    initialState
  );

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <input type="hidden" name="redirect" value={redirectTo ?? "/dashboard"} />

      <label className="order-card">
        <strong>Email</strong>
        <input
          name="email"
          type="email"
          placeholder="owner@business.com"
          autoComplete="email"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Password</strong>
        <input
          name="password"
          type="password"
          placeholder="Enter password"
          autoComplete="current-password"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      {state.message ? <div className="muted">{state.message}</div> : null}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Signing In..." : "Sign In"}
        </button>
        <Link href="/forgot-password" className="ghost-btn">
          Forgot password?
        </Link>
      </div>
    </form>
  );
}