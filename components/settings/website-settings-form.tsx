"use client";

import { useActionState } from "react";
import { updateWebsiteSettings } from "@/lib/settings/actions";

const initialState = { ok: false, message: "" };

export function WebsiteSettingsForm({
  defaults,
}: {
  defaults: { heroMessage: string; heroHeadline: string; serviceAreaText: string; bookingMessage: string };
}) {
  const [state, formAction, pending] = useActionState(updateWebsiteSettings, initialState);

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <label className="order-card">
        <strong>Hero headline</strong>
        <input
          name="hero_headline"
          type="text"
          defaultValue={defaults.heroHeadline}
          placeholder="Your Next Party, Booked in Minutes"
          style={{ marginTop: 8, width: "100%" }}
        />
        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          Main headline on your homepage hero. Leave blank for the default.
        </div>
      </label>

      <label className="order-card">
        <strong>Homepage hero message</strong>
        <textarea
          name="hero_message"
          defaultValue={defaults.heroMessage}
          placeholder="Book fun faster. Run operations from one place."
          rows={2}
          style={{ marginTop: 8, width: "100%", fontFamily: "inherit", border: "1px solid var(--border)", borderRadius: 12, padding: 12 }}
        />
      </label>

      <label className="order-card">
        <strong>Service area display text</strong>
        <input
          name="service_area_text"
          type="text"
          defaultValue={defaults.serviceAreaText}
          placeholder="Serving Stafford, Fredericksburg, and Northern Virginia"
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Checkout / booking message</strong>
        <input
          name="booking_message"
          type="text"
          defaultValue={defaults.bookingMessage}
          placeholder="A deposit is required to confirm your reservation."
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
          {pending ? "Saving..." : "Save Website Settings"}
        </button>
      </div>
    </form>
  );
}
