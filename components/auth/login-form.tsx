"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInWithPassword, resendVerificationEmail } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState = {
  ok: false,
  message: "",
};
const resendInitial = { ok: false, message: "" };

interface LoginFormLabels {
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  signIn: string;
  signingIn: string;
  forgotPasswordLink: string;
}

export function LoginForm({
  redirectTo,
  labels,
}: {
  redirectTo?: string;
  labels?: LoginFormLabels;
}) {
  const { messages } = useI18n();
  const l: LoginFormLabels = labels ?? {
    email: messages.auth.form.email,
    emailPlaceholder: messages.auth.form.emailPlaceholder,
    password: messages.auth.form.password,
    passwordPlaceholder: messages.auth.form.passwordPlaceholder,
    signIn: messages.auth.form.signIn,
    signingIn: messages.auth.form.signingIn,
    forgotPasswordLink: messages.auth.form.forgotPasswordLink,
  };

  const [state, formAction, pending] = useActionState(
    signInWithPassword,
    initialState
  );
  const [resendState, resendAction, resendPending] = useActionState(
    resendVerificationEmail,
    resendInitial
  );

  return (
    <>
      <form action={formAction} className="list" style={{ marginTop: 16 }}>
        <input type="hidden" name="redirect" value={redirectTo ?? "/dashboard"} />

        <label className="order-card">
          <strong>{l.email}</strong>
          <input
            name="email"
            type="email"
            placeholder={l.emailPlaceholder}
            autoComplete="email"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>{l.password}</strong>
          <input
            name="password"
            type="password"
            placeholder={l.passwordPlaceholder}
            autoComplete="current-password"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        {state.message ? <div role="alert" aria-live="assertive" className="muted">{state.message}</div> : null}

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button className="primary-btn" type="submit" disabled={pending}>
            {pending ? l.signingIn : l.signIn}
          </button>
          <Link href="/forgot-password" className="ghost-btn">
            {l.forgotPasswordLink}
          </Link>
        </div>
      </form>

      {/* Resend-verification affordance. Rendered as a separate form so it
          can be triggered without re-submitting the password form. Only
          appears once a sign-in attempt has surfaced needsVerification. */}
      {state.needsVerification && state.email && (
        <form action={resendAction} style={{ marginTop: 12 }}>
          <input type="hidden" name="email" value={state.email} />
          <button
            type="submit"
            className="ghost-btn"
            disabled={resendPending}
            style={{ fontSize: 13 }}
          >
            {resendPending
              ? messages.auth.form.resendingVerification
              : messages.auth.form.resendVerification}
          </button>
          {resendState.message && (
            <div
              role={resendState.ok ? "status" : "alert"}
              aria-live="polite"
              className="muted"
              style={{ marginTop: 8, fontSize: 13 }}
            >
              {resendState.message}
            </div>
          )}
        </form>
      )}
    </>
  );
}
