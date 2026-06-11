"use client";

import { useActionState } from "react";
import { submitFollowup, type FollowupState } from "@/lib/market/followup-actions";

const initial: FollowupState = { ok: false, message: "" };

/**
 * Post-rental follow-up — short on purpose (three taps for a clean
 * rental). The renter version pairs with the review form; the seller
 * version adds "would you rent to them again?".
 */
export function FollowupForm({
  bookingId,
  party,
}: {
  bookingId: string;
  party: "renter" | "seller";
}) {
  const [state, action, pending] = useActionState(submitFollowup, initial);

  if (state.ok) {
    return <p style={{ fontSize: 12, color: "#1e7f4f", marginTop: 6 }}>✓ {state.message}</p>;
  }

  const radio: React.CSSProperties = { fontSize: 12, display: "flex", gap: 4, alignItems: "center" };

  return (
    <form
      action={action}
      style={{
        marginTop: 8,
        padding: 10,
        border: "1px dashed #e5e0d8",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        fontSize: 12,
      }}
    >
      <input type="hidden" name="booking_id" value={bookingId} />
      <b>
        Quick follow-up —{" "}
        {party === "renter" ? "how was the rental?" : "how did this rental go on your end?"}
      </b>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <label style={radio}>
          <input type="radio" name="overall" value="great" defaultChecked /> 😊 Great
        </label>
        <label style={radio}>
          <input type="radio" name="overall" value="okay" /> 😐 Okay
        </label>
        <label style={radio}>
          <input type="radio" name="overall" value="problem" /> ⚠️ There was a problem
        </label>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <label style={radio}>
          <input type="checkbox" name="item_issue" />{" "}
          {party === "renter"
            ? "The item had an issue (not as described / not working)"
            : "The item came back with an issue (damage / missing parts)"}
        </label>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <label style={radio}>
          <input type="checkbox" name="suspicious" /> Something felt off (off-platform
          payment pressure, identity concerns, etc.)
        </label>
      </div>
      {party === "seller" ? (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>Rent to them again?</span>
          <label style={radio}>
            <input type="radio" name="would_repeat" value="yes" defaultChecked /> Yes
          </label>
          <label style={radio}>
            <input type="radio" name="would_repeat" value="no" /> No
          </label>
        </div>
      ) : null}
      <textarea
        name="notes"
        maxLength={2000}
        rows={2}
        placeholder="Anything the trust team should know? (optional)"
        style={{ fontSize: 12, padding: 8, borderRadius: 8, border: "1px solid #e5e0d8" }}
      />
      <button
        type="submit"
        disabled={pending}
        style={{ alignSelf: "flex-start", fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 999, border: "1px solid currentColor", background: "transparent", cursor: "pointer" }}
      >
        {pending ? "Sending…" : "Submit follow-up"}
      </button>
      {state.message ? <span style={{ color: "#b91c1c" }}>{state.message}</span> : null}
    </form>
  );
}
