"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/auth/actions";

const initialState = {
  ok: false,
  message: "",
};

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState
  );

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
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

      {state.message ? <div className="muted">{state.message}</div> : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Sending..." : "Email me a reset link"}
        </button>
        <Link href="/login" className="ghost-btn">
          Back to login
        </Link>
      </div>
    </form>
  );
}