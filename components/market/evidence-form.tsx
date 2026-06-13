"use client";

import { useActionState } from "react";
import { submitEvidence, type EvidenceState } from "@/lib/market/evidence-actions";

const initial: EvidenceState = { ok: false, message: "" };

/**
 * Evidence capture (Phase 1, the locked rental flow). Up to 6 photos
 * per submit. `actor` tunes the copy: the seller's handoff upload is
 * the blocking before-baseline; the renter's pickup/return uploads are
 * dispute-eligibility (skipping them weakens your standing).
 */
export function EvidenceForm({
  bookingId,
  phase,
  actor = "renter",
}: {
  bookingId: string;
  phase: "handoff" | "return";
  actor?: "seller" | "renter";
}) {
  const [state, action, pending] = useActionState(submitEvidence, initial);

  if (state.ok) {
    return <p style={{ fontSize: 12, color: "#1e7f4f", margin: "6px 0 0" }}>✓ {state.message}</p>;
  }

  const label =
    actor === "seller" && phase === "handoff"
      ? "📸 Upload before-photos"
      : phase === "handoff"
        ? "📸 Pickup photos"
        : "📸 Return photos";

  const hint =
    actor === "seller" && phase === "handoff"
      ? "Required before checkout: 2+ clear photos of the item's condition (and its serial/label if it has one). This is your proof of how you handed it over."
      : phase === "handoff"
        ? "Photograph the item at pickup (within ~4 hours). This protects you — it documents any pre-existing wear so it can't be blamed on you later."
        : "Photograph the item as you return it (within ~24 hours). This is your proof of the condition you gave it back in.";

  return (
    <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 11, color: "var(--mk-ink-soft)", margin: "0 0 6px", lineHeight: 1.5 }}>
        {hint}
      </p>
      <form action={action} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input type="hidden" name="booking_id" value={bookingId} />
        <input type="hidden" name="phase" value={phase} />
        <input
          type="file"
          name="photo"
          multiple
          accept="image/jpeg,image/png,image/webp"
          style={{ fontSize: 12, maxWidth: 230 }}
        />
        <input
          type="text"
          name="note"
          placeholder="Condition note (optional)"
          maxLength={1000}
          style={{ fontSize: 12, padding: "6px 10px", border: "1px solid #e5e0d8", borderRadius: 8, flex: 1, minWidth: 140 }}
        />
        <button type="submit" disabled={pending} style={{ fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 999, border: "1px solid currentColor", background: "transparent", cursor: "pointer" }}>
          {pending ? "Saving…" : label}
        </button>
        {state.message ? (
          <span style={{ fontSize: 12, color: "#b91c1c", width: "100%" }}>{state.message}</span>
        ) : null}
      </form>
    </div>
  );
}
