"use client";

import { useActionState } from "react";
import { submitContactForm, type ContactState } from "@/lib/contact/actions";

const initial: ContactState = { ok: false, message: "" };

export function ContactForm() {
  const [state, action, isPending] = useActionState(submitContactForm, initial);

  return (
    <form action={action} className="contact-form">
      <label className="storefront-field">
        <span>Your Name</span>
        <input name="name" type="text" required maxLength={100} />
      </label>

      <label className="storefront-field">
        <span>Email Address</span>
        <input name="email" type="email" required />
      </label>

      <label className="storefront-field">
        <span>Message</span>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          style={{ resize: "vertical" }}
        />
      </label>

      <button
        type="submit"
        className="primary-btn"
        disabled={isPending}
        style={{ width: "100%", minHeight: 48 }}
      >
        {isPending ? "Sending..." : "Send Message"}
      </button>

      {state.message && (
        <div
          className={`badge ${state.ok ? "success" : "warning"}`}
          style={{ textAlign: "center", padding: "10px 16px", marginTop: 8 }}
        >
          {state.message}
        </div>
      )}
    </form>
  );
}
