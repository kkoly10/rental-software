"use client";

import { useActionState } from "react";
import { submitContactForm, type ContactState } from "@/lib/contact/actions";
import { useI18n } from "@/lib/i18n/provider";

const initial: ContactState = { ok: false, message: "" };

export function ContactForm() {
  const { messages: m } = useI18n();
  const [state, action, isPending] = useActionState(submitContactForm, initial);

  return (
    <form action={action} className="contact-form">
      <label className="storefront-field">
        <span>{m.contact.name}</span>
        <input name="name" type="text" required maxLength={100} />
      </label>

      <label className="storefront-field">
        <span>{m.contact.email}</span>
        <input name="email" type="email" required />
      </label>

      <label className="storefront-field">
        <span>{m.contact.message}</span>
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
        {isPending ? m.contact.sending : m.contact.submit}
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
