"use client";

import { useActionState } from "react";
import { updateWebsiteSettings } from "@/lib/settings/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState = { ok: false, message: "" };

export function WebsiteSettingsForm({
  defaults,
}: {
  defaults: { heroMessage: string; heroHeadline: string; serviceAreaText: string; bookingMessage: string };
}) {
  const [state, formAction, pending] = useActionState(updateWebsiteSettings, initialState);
  const { messages } = useI18n();
  const m = messages.forms.websiteSettings;

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <label className="order-card">
        <strong>{m.heroHeadlineLabel}</strong>
        <input
          name="hero_headline"
          type="text"
          defaultValue={defaults.heroHeadline}
          placeholder={m.heroHeadlinePlaceholder}
          style={{ marginTop: 8, width: "100%" }}
        />
        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          {m.heroHeadlineHelp}
        </div>
      </label>

      <label className="order-card">
        <strong>{m.heroMessageLabel}</strong>
        <textarea
          name="hero_message"
          defaultValue={defaults.heroMessage}
          placeholder={m.heroMessagePlaceholder}
          rows={2}
          style={{ marginTop: 8, width: "100%", fontFamily: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}
        />
      </label>

      <label className="order-card">
        <strong>{m.serviceAreaTextLabel}</strong>
        <input
          name="service_area_text"
          type="text"
          defaultValue={defaults.serviceAreaText}
          placeholder={m.serviceAreaTextPlaceholder}
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>{m.bookingMessageLabel}</strong>
        <input
          name="booking_message"
          type="text"
          defaultValue={defaults.bookingMessage}
          placeholder={m.bookingMessagePlaceholder}
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      <div>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? m.submitting : m.submit}
        </button>
      </div>
    </form>
  );
}
