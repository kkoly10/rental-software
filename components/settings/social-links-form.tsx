"use client";

import { useActionState } from "react";
import { updateSocialLinks } from "@/lib/settings/brand-upload-actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState = { ok: false, message: "" };

export function SocialLinksForm({
  defaults,
}: {
  defaults: {
    facebook: string;
    instagram: string;
    tiktok: string;
    googleBusiness: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updateSocialLinks, initialState);
  const { messages } = useI18n();
  const m = messages.forms.socialLinks;

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <label className="order-card">
        <strong>{m.facebookLabel}</strong>
        <input
          name="social_facebook"
          type="url"
          defaultValue={defaults.facebook}
          placeholder={m.facebookPlaceholder}
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>{m.instagramLabel}</strong>
        <input
          name="social_instagram"
          type="url"
          defaultValue={defaults.instagram}
          placeholder={m.instagramPlaceholder}
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>{m.tiktokLabel}</strong>
        <input
          name="social_tiktok"
          type="url"
          defaultValue={defaults.tiktok}
          placeholder={m.tiktokPlaceholder}
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>{m.googleBusinessLabel}</strong>
        <input
          name="social_google_business"
          type="url"
          defaultValue={defaults.googleBusiness}
          placeholder={m.googleBusinessPlaceholder}
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
