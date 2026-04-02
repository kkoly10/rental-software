"use client";

import { useActionState } from "react";
import { updateSocialLinks } from "@/lib/settings/brand-upload-actions";

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

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <label className="order-card">
        <strong>Facebook</strong>
        <input
          name="social_facebook"
          type="url"
          defaultValue={defaults.facebook}
          placeholder="https://facebook.com/yourbusiness"
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Instagram</strong>
        <input
          name="social_instagram"
          type="url"
          defaultValue={defaults.instagram}
          placeholder="https://instagram.com/yourbusiness"
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>TikTok</strong>
        <input
          name="social_tiktok"
          type="url"
          defaultValue={defaults.tiktok}
          placeholder="https://tiktok.com/@yourbusiness"
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Google Business Profile</strong>
        <input
          name="social_google_business"
          type="url"
          defaultValue={defaults.googleBusiness}
          placeholder="https://g.page/yourbusiness"
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
          {pending ? "Saving..." : "Save Social Links"}
        </button>
      </div>
    </form>
  );
}
