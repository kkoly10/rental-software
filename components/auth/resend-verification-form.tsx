"use client";

import { useActionState } from "react";
import { resendVerificationEmail, type AuthActionState } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/provider";

const initial: AuthActionState = { ok: false, message: "" };

/**
 * Self-serve "send me a fresh confirmation link" form. Shown on the
 * verify-email interstitial and the auth-error page so a user whose link
 * failed (expired, already used, or opened in a different browser than
 * they signed up in — the common mobile mail-app in-app-browser case)
 * can recover without contacting support. Requesting from the device
 * they'll click on also sidesteps the cross-browser PKCE issue.
 */
export function ResendVerificationForm({ defaultEmail = "" }: { defaultEmail?: string }) {
  const { messages: m } = useI18n();
  const [state, action, pending] = useActionState(resendVerificationEmail, initial);

  return (
    <form action={action} className="auth-fields" style={{ marginTop: 4 }}>
      <label className="auth-field">
        <span>{m.auth.form.email}</span>
        <input
          name="email"
          type="email"
          defaultValue={defaultEmail}
          placeholder={m.auth.form.emailPlaceholder}
          autoComplete="email"
        />
      </label>
      {state.message && (
        <div role={state.ok ? "status" : "alert"} aria-live="polite" className="muted">
          {state.message}
        </div>
      )}
      <div className="auth-actions">
        <button className="secondary-btn" type="submit" disabled={pending}>
          {pending ? m.auth.verifyEmail.resending : m.auth.verifyEmail.resend}
        </button>
      </div>
    </form>
  );
}
