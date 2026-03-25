"use client";

import { useActionState } from "react";
import { completeOnboarding } from "@/lib/onboarding/actions";

const initialState = { ok: false, message: "" };

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState(completeOnboarding, initialState);

  return (
    <form action={formAction} className="list" style={{ marginTop: 16 }}>
      <label className="order-card">
        <strong>Business name</strong>
        <input
          name="business_name"
          type="text"
          placeholder="e.g. Fun Zone Inflatables"
          required
          style={{ marginTop: 10, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Timezone</strong>
        <select name="timezone" defaultValue="America/New_York" style={{ marginTop: 10, width: "100%" }}>
          <option value="America/New_York">Eastern (ET)</option>
          <option value="America/Chicago">Central (CT)</option>
          <option value="America/Denver">Mountain (MT)</option>
          <option value="America/Los_Angeles">Pacific (PT)</option>
        </select>
      </label>

      <div className="grid grid-3">
        <label className="order-card">
          <strong>Primary ZIP code</strong>
          <input
            name="zip_code"
            type="text"
            placeholder="22554"
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>Default delivery fee</strong>
          <input
            name="delivery_fee"
            type="number"
            step="1"
            min="0"
            defaultValue={25}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>

        <label className="order-card">
          <strong>Minimum order ($)</strong>
          <input
            name="minimum_order"
            type="number"
            step="1"
            min="0"
            defaultValue={100}
            style={{ marginTop: 10, width: "100%" }}
          />
        </label>
      </div>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "10px 14px" }}>
          {state.message}
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button className="primary-btn" type="submit" disabled={pending}>
          {pending ? "Setting up..." : "Create Business & Continue"}
        </button>
      </div>
    </form>
  );
}
