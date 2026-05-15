"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState = {
  ok: false,
  message: "",
};

export function ForgotPasswordForm() {
  const { messages: m } = useI18n();
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState
  );

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <label className="order-card">
        <strong>{m.auth.form.email}</strong>
        <input
          name="email"
          type="email"
          placeholder={m.auth.form.emailPlaceholder}
          autoComplete="email"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      {state.message ? <div className="muted">{state.message}</div> : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? m.auth.form.resetting : m.auth.form.sendResetLink}
        </button>
        <Link href="/login" className="ghost-btn">
          {m.auth.forgotPassword.backToLogin}
        </Link>
      </div>
    </form>
  );
}
