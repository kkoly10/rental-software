"use client";

import { useActionState, useState } from "react";
import { uploadProofPhoto, type StopActionState } from "@/lib/crew/actions";
import { useI18n } from "@/lib/i18n/provider";

const initial: StopActionState = { ok: false, message: "" };

export function ProofPhotoUpload({ stopId, existingUrl }: { stopId: string; existingUrl?: string }) {
  const { messages } = useI18n();
  const t = messages.forms.crew.proofPhoto;
  const [state, action, pending] = useActionState(uploadProofPhoto, initial);
  const [preview, setPreview] = useState<string | null>(existingUrl ?? null);

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
          <img src={preview} alt={t.setupPhotoAlt} style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />
        )}
        <span className="badge success">{t.photoSaved}</span>
      </div>
    );
  }

  return (
    <form action={action} style={{ marginTop: 8 }}>
      <input type="hidden" name="stop_id" value={stopId} />

      {preview && (
        <img src={preview} alt={t.previewAlt} style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          name="photo"
          type="file"
          accept="image/*"
          capture="environment"
          aria-label="Proof of delivery photo"
          onChange={handleChange}
          style={{ fontSize: 13, flex: 1 }}
        />
        <button type="submit" className="primary-btn" disabled={pending} style={{ fontSize: 12, padding: "6px 14px", flexShrink: 0 }}>
          {pending ? t.saving : t.savePhoto}
        </button>
      </div>

      {state.message && !state.ok && (
        <div className="badge warning" style={{ marginTop: 6, fontSize: 12 }}>{state.message}</div>
      )}
    </form>
  );
}
