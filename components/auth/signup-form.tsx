"use client";

import { useActionState } from "react";
import { signUpWithPassword } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState = {
  ok: false,
  message: "",
};

export function SignupForm() {
  const { messages: m } = useI18n();
  const [state, formAction, pending] = useActionState(signUpWithPassword, initialState);

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <label className="order-card">
        <strong>{m.auth.form.name}</strong>
        <input name="full_name" type="text" placeholder={m.auth.form.namePlaceholder} style={{ marginTop: 10, width: "100%" }} />
      </label>

      <label className="order-card">
        <strong>Phone</strong>
        <input name="phone" type="tel" placeholder="(540) 555-0100" style={{ marginTop: 10, width: "100%" }} />
      </label>

      <label className="order-card">
        <strong>{m.auth.form.email}</strong>
        <input name="email" type="email" placeholder={m.auth.form.emailPlaceholder} style={{ marginTop: 10, width: "100%" }} />
      </label>

      <label className="order-card">
        <strong>{m.auth.form.password}</strong>
        <input name="password" type="password" placeholder={m.auth.form.passwordPlaceholder} style={{ marginTop: 10, width: "100%" }} />
      </label>

      <label
        className="order-card"
        style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
      >
        <input
          name="terms_accepted"
          type="checkbox"
          required
          value="true"
          style={{ marginTop: 3, width: "auto", flexShrink: 0 }}
        />
        <span style={{ fontSize: 14, lineHeight: 1.5 }}>
          {m.auth.signup.termsAgreement}{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: 600 }}>
            {m.auth.signup.terms}
          </a>{" "}
          {m.common.and}{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: 600 }}>
            {m.auth.signup.privacy}
          </a>
        </span>
      </label>

      {state.message ? <div role="alert" aria-live="assertive" className="muted">{state.message}</div> : null}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? m.auth.form.signingUp : m.auth.form.signUp}
        </button>
      </div>
    </form>
  );
}
