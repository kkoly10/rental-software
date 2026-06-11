"use client";

import { useActionState } from "react";
import {
  createMarketplaceSellerOrg,
  type SellerSignupState,
} from "@/lib/market/seller-signup-actions";

const initial: SellerSignupState = { ok: false, message: "" };

export function SellerSignupForm() {
  const [state, action, pending] = useActionState(createMarketplaceSellerOrg, initial);

  if (state.ok) {
    return (
      <div>
        <p className="mk-msg ok">✓ {state.message}</p>
        <a className="mk-btn" href="/market/hub" style={{ marginTop: 10 }}>
          Open Seller Hub →
        </a>
      </div>
    );
  }

  return (
    <form action={action}>
      <label style={{ fontSize: 12, fontWeight: 700, display: "block" }}>
        Business or display name
        <input
          name="business_name"
          required
          minLength={2}
          maxLength={80}
          placeholder="Dana's Event Gear"
          style={{ width: "100%", padding: "10px 14px", border: "1px solid var(--mk-line, #f0e4d8)", borderRadius: 10, font: "inherit", marginTop: 4 }}
        />
      </label>
      <button type="submit" className="mk-btn" style={{ width: "100%", marginTop: 14 }} disabled={pending}>
        {pending ? "Creating…" : "Create seller account (15% fee, list free)"}
      </button>
      {state.message ? <p className="mk-msg err">{state.message}</p> : null}
    </form>
  );
}
