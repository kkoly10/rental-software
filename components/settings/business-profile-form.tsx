"use client";

import { useActionState } from "react";
import { updateBusinessProfile } from "@/lib/settings/actions";

const initialState = { ok: false, message: "" };

export function BusinessProfileForm({
  defaults,
}: {
  defaults: { name: string; supportEmail: string; phone: string; timezone: string };
}) {
  const [state, formAction, pending] = useActionState(updateBusinessProfile, initialState);

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <label className="order-card">
        <strong>Business name</strong>
        <input name="name" type="text" defaultValue={defaults.name} required style={{ marginTop: 8, width: "100%" }} />
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>Support email</strong>
          <input name="support_email" type="email" defaultValue={defaults.supportEmail} placeholder="support@example.com" style={{ marginTop: 8, width: "100%" }} />
        </label>

        <label className="order-card">
          <strong>Phone</strong>
          <input name="phone" type="tel" defaultValue={defaults.phone} placeholder="(540) 555-0100" style={{ marginTop: 8, width: "100%" }} />
        </label>

        <label className="order-card">
          <strong>Timezone</strong>
          <select name="timezone" defaultValue={defaults.timezone} style={{ marginTop: 8, width: "100%" }}>
            <option value="America/New_York">Eastern</option>
            <option value="America/Chicago">Central</option>
            <option value="America/Denver">Mountain</option>
            <option value="America/Los_Angeles">Pacific</option>
          </select>
        </label>
      </div>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      <div>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </form>
  );
}
