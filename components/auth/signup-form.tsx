"use client";

import { useActionState, useEffect, useState } from "react";
import { signUpWithPassword, type AuthActionState } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState: AuthActionState = {
  ok: false,
  message: "",
};

export function SignupForm() {
  const { messages: m } = useI18n();
  const [state, formAction, pending] = useActionState(signUpWithPassword, initialState);

  // Controlled inputs so the text-field values stick after a failed
  // submit. signUpWithPassword echoes email + fullName + phone back on
  // every error path; useEffect syncs the latest server echo into local
  // state. Password + terms are intentionally NOT preserved — password
  // for security, terms to force a fresh acknowledgment on retry.
  const [fullName, setFullName] = useState(state.fullName ?? "");
  const [phone, setPhone] = useState(state.phone ?? "");
  const [email, setEmail] = useState(state.email ?? "");
  useEffect(() => {
    if (typeof state.fullName === "string" && state.fullName !== fullName) setFullName(state.fullName);
    if (typeof state.phone === "string" && state.phone !== phone) setPhone(state.phone);
    if (typeof state.email === "string" && state.email !== email) setEmail(state.email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fullName, state.phone, state.email]);

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <label className="order-card">
        <strong>{m.auth.form.name}</strong>
        <input name="full_name" type="text" placeholder={m.auth.form.namePlaceholder} value={fullName} onChange={(e) => setFullName(e.target.value)} style={{ marginTop: 10, width: "100%" }} />
      </label>

      <label className="order-card">
        <strong>Phone</strong>
        <input name="phone" type="tel" placeholder="(540) 555-0100" value={phone} onChange={(e) => setPhone(e.target.value)} style={{ marginTop: 10, width: "100%" }} />
      </label>

      <label className="order-card">
        <strong>{m.auth.form.email}</strong>
        <input name="email" type="email" placeholder={m.auth.form.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginTop: 10, width: "100%" }} />
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
