"use client";

import { useActionState } from "react";
import { updateLegalLinks } from "@/lib/settings/content-actions";

const initialState = { ok: false, message: "" };

export function LegalLinksForm({
  defaults,
}: {
  defaults: {
    privacyUrl: string;
    termsUrl: string;
    waiverUrl: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updateLegalLinks, initialState);

  return (
    <form action={formAction} className="list" style={{ marginTop: 12 }}>
      <p className="muted" style={{ fontSize: 13, margin: "0 0 4px", lineHeight: 1.5 }}>
        Your storefront shows Privacy and Terms links so customers booking and
        paying online can find them. By default it uses Korent&rsquo;s baseline
        pages written for your business. If you have your own legal pages —
        recommended, and worth reviewing with your own attorney — paste their
        links below to use them instead.
      </p>

      <label className="order-card">
        <strong>Privacy policy URL</strong>
        <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 2 }}>
          Leave blank to use Korent&rsquo;s baseline privacy page.
        </span>
        <input
          name="legal_privacy_url"
          type="url"
          defaultValue={defaults.privacyUrl}
          placeholder="https://yoursite.com/privacy"
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Terms URL</strong>
        <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 2 }}>
          Leave blank to use Korent&rsquo;s baseline rental-terms page.
        </span>
        <input
          name="legal_terms_url"
          type="url"
          defaultValue={defaults.termsUrl}
          placeholder="https://yoursite.com/terms"
          style={{ marginTop: 8, width: "100%" }}
        />
      </label>

      <label className="order-card">
        <strong>Rental agreement / waiver URL</strong>
        <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 2 }}>
          Optional. If you have a liability waiver or rental agreement online,
          link it here and it appears in your storefront footer.
        </span>
        <input
          name="legal_waiver_url"
          type="url"
          defaultValue={defaults.waiverUrl}
          placeholder="https://yoursite.com/rental-agreement"
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
          {pending ? "Saving…" : "Save legal links"}
        </button>
      </div>
    </form>
  );
}
