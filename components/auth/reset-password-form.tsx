"use client";

import { useActionState } from "react";
import { resetPassword } from "@/lib/auth/actions";

const initialState = {
  ok: false,
  message: "",
};

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState(resetPassword, initialState);

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <label className="order-card">
        <strong>New password</strong>
        <input
          name="password"
          type="password"
          placeholder="Create a new password"
          autoComplete="new-password"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Confirm password</strong>
        <input
          name="confirm_password"
          type="password"
          placeholder="Re-enter your new password"
          autoComplete="new-password"
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      {state.message ? <div className="muted">{state.message}</div> : null}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Updating..." : "Update password"}
        </button>
      </div>
    </form>
  );
}
