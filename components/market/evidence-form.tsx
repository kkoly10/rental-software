"use client";

import { useActionState } from "react";
import { submitEvidence, type EvidenceState } from "@/lib/market/evidence-actions";

const initial: EvidenceState = { ok: false, message: "" };

/**
 * §16 evidence capture, both surfaces (Seller Hub + renter rentals).
 * One photo, optional note — deliberately light (the noob-first
 * design: one photo two moments beats a six-slot protocol nobody
 * completes on a Saturday morning).
 */
export function EvidenceForm({
  bookingId,
  phase,
}: {
  bookingId: string;
  phase: "handoff" | "return";
}) {
  const [state, action, pending] = useActionState(submitEvidence, initial);

  if (state.ok) {
    return <p style={{ fontSize: 12, color: "#1e7f4f", margin: "6px 0 0" }}>✓ {state.message}</p>;
  }

  return (
    <form action={action} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="phase" value={phase} />
      <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" style={{ fontSize: 12, maxWidth: 210 }} />
      <input
        type="text"
        name="note"
        placeholder={phase === "handoff" ? "Condition note (optional)" : "Return note (optional)"}
        maxLength={1000}
        style={{ fontSize: 12, padding: "6px 10px", border: "1px solid #e5e0d8", borderRadius: 8, flex: 1, minWidth: 140 }}
      />
      <button type="submit" disabled={pending} style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 999, border: "1px solid currentColor", background: "transparent", cursor: "pointer" }}>
        {pending ? "Saving…" : phase === "handoff" ? "📸 Handoff photo" : "📸 Return photo"}
      </button>
      {state.message ? (
        <span style={{ fontSize: 12, color: "#b91c1c", width: "100%" }}>{state.message}</span>
      ) : null}
    </form>
  );
}
