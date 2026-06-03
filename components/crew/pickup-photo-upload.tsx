"use client";

import { useActionState, useState } from "react";
import { uploadPickupPhoto, type StopActionState } from "@/lib/crew/actions";

const initial: StopActionState = { ok: false, message: "" };

/**
 * Sprint 5.5 — pickup-side photo capture mirroring ProofPhotoUpload.
 *
 * The key UX addition: the **visual matching nudge**. When a delivery
 * photo exists for the same stop, render it as a thumbnail above the
 * capture input with copy "Match this angle." Big companies solve this
 * with structured photo slots; for noob crews on a busy Saturday, the
 * nudge gives the same outcome (comparable before/after pairs) without
 * any forced protocol.
 *
 * Capture is optional — the crew can complete the pickup stop without
 * uploading. Most operators encourage but don't require it, per the
 * Sprint 5.5 design philosophy in
 * docs/architecture/equipment-condition-photos.md.
 */
export function PickupPhotoUpload({
  stopId,
  deliveryPhotoUrl,
  existingUrl,
}: {
  stopId: string;
  /** The matching delivery-side photo. When present, surface as a "match this angle" thumbnail. */
  deliveryPhotoUrl?: string | null;
  existingUrl?: string;
}) {
  const [state, action, pending] = useActionState(uploadPickupPhoto, initial);
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPreview(URL.createObjectURL(file));
  }

  if (state.ok && state.message === "Pickup photo saved.") {
    return (
      <div style={{ marginTop: 8 }}>
        {preview && (
          <img
            src={preview}
            alt="Pickup photo"
            style={{ width: "100%", borderRadius: 8, marginBottom: 8 }}
          />
        )}
        <span className="badge success">Pickup photo saved.</span>
      </div>
    );
  }

  return (
    <form action={action} style={{ marginTop: 8 }}>
      <input type="hidden" name="stop_id" value={stopId} />

      {deliveryPhotoUrl && !preview && (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            background: "var(--primary-bg, #f4f7fb)",
            borderRadius: 8,
            border: "1px dashed var(--border-color, #dbe6f4)",
          }}
        >
          <div
            className="muted"
            style={{ fontSize: 12, marginBottom: 6, fontWeight: 600 }}
          >
            Match this angle
          </div>
          <img
            src={deliveryPhotoUrl}
            alt="Delivery photo for matching reference"
            style={{ width: "100%", borderRadius: 6, opacity: 0.85 }}
          />
          <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>
            Photo taken at delivery. Try to capture the equipment from
            the same angle so condition is easy to compare.
          </div>
        </div>
      )}

      {preview && (
        <img
          src={preview}
          alt="Pickup photo preview"
          style={{ width: "100%", borderRadius: 8, marginBottom: 8 }}
        />
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          name="photo"
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Pickup condition photo"
          onChange={handleChange}
          style={{ fontSize: 13, flex: 1 }}
        />
        <button
          type="submit"
          className="primary-btn"
          disabled={pending}
          style={{ fontSize: 12, padding: "6px 14px", flexShrink: 0 }}
        >
          {pending ? "Saving…" : "Save pickup photo"}
        </button>
      </div>

      {state.message && !state.ok && (
        <div className="badge warning" style={{ marginTop: 6, fontSize: 12 }}>
          {state.message}
        </div>
      )}
    </form>
  );
}
