"use client";

import { useActionState } from "react";
import { resetPassword } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState = {
  ok: false,
  message: "",
};

export function ResetPasswordForm() {
  const { messages: m } = useI18n();
  const [state, formAction, pending] = useActionState(resetPassword, initialState);

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <label className="order-card">
        <strong>{m.auth.form.newPassword}</strong>
        <input
          name="password"
          type="password"
          placeholder={m.auth.form.passwordPlaceholder}
          autoComplete="new-password"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>{m.auth.form.confirmPassword}</strong>
        <input
          name="confirm_password"
          type="password"
          placeholder={m.auth.form.passwordPlaceholder}
          autoComplete="new-password"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      {state.message ? <div className="muted">{state.message}</div> : null}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? m.auth.form.updating : m.auth.form.updatePassword}
        </button>
      </div>
    </form>
  );
}
