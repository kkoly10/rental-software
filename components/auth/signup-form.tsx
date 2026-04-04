"use client";

import { useActionState } from "react";
import { signUpWithPassword } from "@/lib/auth/actions";

const initialState = {
  ok: false,
  message: "",
};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUpWithPassword, initialState);

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <label className="order-card">
        <strong>Full name</strong>
        <input name="full_name" type="text" placeholder="Your full name" style={{ marginTop: 10, width: "100%" }} />
      </label>

      <label className="order-card">
        <strong>Phone</strong>
        <input name="phone" type="tel" placeholder="(540) 555-0100" style={{ marginTop: 10, width: "100%" }} />
      </label>

      <label className="order-card">
        <strong>Email</strong>
        <input name="email" type="email" placeholder="owner@business.com" style={{ marginTop: 10, width: "100%" }} />
      </label>

      <label className="order-card">
        <strong>Password</strong>
        <input name="password" type="password" placeholder="Create password" style={{ marginTop: 10, width: "100%" }} />
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
          I agree to the{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: 600 }}>
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "var(--primary)", fontWeight: 600 }}>
            Privacy Policy
          </a>
        </span>
      </label>

      {state.message ? <div className="muted">{state.message}</div> : null}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Creating Account..." : "Create Account"}
        </button>
      </div>
    </form>
  );
}
