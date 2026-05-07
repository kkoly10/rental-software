"use client";

import { useActionState, useRef, useState } from "react";
import { uploadProofPhoto, type StopActionState } from "@/lib/crew/actions";

const initial: StopActionState = { ok: false, message: "" };

export function ProofPhotoUpload({ stopId, existingUrl }: { stopId: string; existingUrl?: string }) {
  const [state, action, pending] = useActionState(uploadProofPhoto, initial);
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  }

  if (state.ok && state.message === "Photo saved.") {
    return (
      <div style={{ marginTop: 8 }}>
        {preview && (
          <img src={preview} alt="Setup photo" style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />
        )}
        <span className="badge success">Photo saved</span>
      </div>
    );
  }

  return (
    <form action={action} style={{ marginTop: 8 }}>
      <input type="hidden" name="stop_id" value={stopId} />

      {preview && (
        <img src={preview} alt="Preview" style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          ref={inputRef}
          name="photo"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleChange}
          style={{ fontSize: 13, flex: 1 }}
        />
        <button type="submit" className="primary-btn" disabled={pending} style={{ fontSize: 12, padding: "6px 14px", flexShrink: 0 }}>
          {pending ? "Saving…" : "Save Photo"}
        </button>
      </div>

      {state.message && !state.ok && (
        <div className="badge warning" style={{ marginTop: 6, fontSize: 12 }}>{state.message}</div>
      )}
    </form>
  );
}
