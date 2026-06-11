"use client";

import { useActionState } from "react";
import { submitReview, type ReviewActionState } from "@/lib/market/review-actions";

const initial: ReviewActionState = { ok: false, message: "" };

export function ReviewForm({ bookingId }: { bookingId: string }) {
  const [state, action, pending] = useActionState(submitReview, initial);

  if (state.ok) {
    return <p style={{ fontSize: 12, color: "#1e7f4f", marginTop: 6 }}>✓ {state.message}</p>;
  }

  return (
    <form action={action} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <select name="rating" required defaultValue="5" style={{ fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "1px solid #e5e0d8" }}>
        <option value="5">★★★★★</option>
        <option value="4">★★★★</option>
        <option value="3">★★★</option>
        <option value="2">★★</option>
        <option value="1">★</option>
      </select>
      <input
        type="text"
        name="body"
        maxLength={1000}
        placeholder="How was it? (optional)"
        style={{ flex: 1, minWidth: 160, fontSize: 12, padding: "7px 10px", borderRadius: 8, border: "1px solid #e5e0d8" }}
      />
      <button type="submit" disabled={pending} style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 999, border: "1px solid currentColor", background: "transparent", cursor: "pointer" }}>
        {pending ? "Posting…" : "★ Leave review"}
      </button>
      {state.message ? <span style={{ width: "100%", fontSize: 12, color: "#b91c1c" }}>{state.message}</span> : null}
    </form>
  );
}
