"use client";

import { useActionState, useEffect, useState } from "react";
import { signUpWithPassword, type AuthActionState } from "@/lib/auth/actions";
import { useI18n } from "@/lib/i18n/provider";
import type { VerticalOption } from "@/lib/verticals/options";

const initialState: AuthActionState = {
  ok: false,
  message: "",
};

export function SignupForm({ verticalOptions }: { verticalOptions: VerticalOption[] }) {
  const { messages: m } = useI18n();
  const [state, formAction, pending] = useActionState(signUpWithPassword, initialState);

  // Controlled inputs so the text-field values stick after a failed
  // submit. signUpWithPassword echoes email + fullName + phone + the
  // vertical pick back on every error path; useEffect syncs the latest
  // server echo into local state. Password + terms are intentionally NOT
  // preserved — password for security, terms to force a fresh
  // acknowledgment on retry.
  const [fullName, setFullName] = useState(state.fullName ?? "");
  const [phone, setPhone] = useState(state.phone ?? "");
  const [email, setEmail] = useState(state.email ?? "");
  const [businessType, setBusinessType] = useState(state.businessType ?? "");
  useEffect(() => {
    if (typeof state.fullName === "string" && state.fullName !== fullName) setFullName(state.fullName);
    if (typeof state.phone === "string" && state.phone !== phone) setPhone(state.phone);
    if (typeof state.email === "string" && state.email !== email) setEmail(state.email);
    if (typeof state.businessType === "string" && state.businessType !== businessType) {
      setBusinessType(state.businessType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.fullName, state.phone, state.email, state.businessType]);

  return (
    <form action={formAction} className="auth-fields">
      <fieldset className="auth-field" style={{ border: "none", padding: 0, margin: 0 }}>
        <legend style={{ padding: 0 }}>
          <span>{m.auth.signup.verticalLabel}</span>
        </legend>
        <div className="auth-verticals">
          {verticalOptions.map((opt) => {
            const selected = businessType === opt.value;
            return (
              <label key={opt.value} className={`auth-vertical${selected ? " is-selected" : ""}`}>
                <input
                  type="radio"
                  name="business_type"
                  value={opt.value}
                  checked={selected}
                  onChange={() => setBusinessType(opt.value)}
                />
                <span className="auth-vertical-body">
                  <strong>{opt.label}</strong>
                  <span className="muted">{opt.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="auth-grid-2">
        <label className="auth-field">
          <span>{m.auth.form.name}</span>
          <input
            name="full_name"
            type="text"
            autoComplete="name"
            placeholder={m.auth.form.namePlaceholder}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>

        <label className="auth-field">
          <span>Phone</span>
          <input
            name="phone"
            type="tel"
            autoComplete="tel"
            placeholder="(540) 555-0100"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </label>
      </div>

      <label className="auth-field">
        <span>{m.auth.form.email}</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          placeholder={m.auth.form.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>

      <label className="auth-field">
        <span>{m.auth.form.password}</span>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder={m.auth.form.passwordPlaceholder}
        />
      </label>

      <label className="auth-terms">
        <input name="terms_accepted" type="checkbox" required value="true" />
        <span>
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

      {state.message ? (
        <div role="alert" aria-live="assertive" className="muted">
          {state.message}
        </div>
      ) : null}

      <div className="auth-actions">
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? m.auth.form.signingUp : m.auth.form.signUp}
        </button>
      </div>

      <p className="auth-next">{m.auth.signup.nextStep}</p>
    </form>
  );
}
