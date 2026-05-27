"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { uploadHeroImage, removeHeroImage } from "@/lib/settings/brand-upload-actions";
import type { SettingsActionState } from "@/lib/settings/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState: SettingsActionState = { ok: false, message: "" };

export function HeroImageUpload({ currentUrl }: { currentUrl: string }) {
  const [url, setUrl] = useState(currentUrl);
  const [uploadState, uploadAction, uploading] = useActionState(uploadHeroImage, initialState);
  const [removeState, removeAction, removing] = useActionState(removeHeroImage, initialState);
  const fileRef = useRef<HTMLInputElement>(null);
  const { messages } = useI18n();
  const m = messages.forms.heroImage;

  // Update preview and clear file input when upload succeeds.
  // The action returns the new URL so we don't need a round-trip router.refresh().
  useEffect(() => {
    if (uploadState.ok && uploadState.url) {
      setUrl(uploadState.url);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [uploadState]);

  // Only clear the preview once the server confirms removal — otherwise a
  // failed remove would hide an image that is still persisted.
  useEffect(() => {
    if (removeState.ok && removeState.message) {
      setUrl("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [removeState]);

  const state = removing || removeState.message ? removeState : uploadState;

  return (
    <div className="order-card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <strong>{m.heading}</strong>

      {url && (
        <div style={{ borderRadius: 10, overflow: "hidden", maxHeight: 160 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={m.altPreview}
            style={{ width: "100%", height: 160, objectFit: "cover" }}
          />
        </div>
      )}

      <form action={uploadAction}>
        <input
          ref={fileRef}
          name="hero_file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          style={{ fontSize: 13 }}
        />
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {m.helpText}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="primary-btn" type="submit" disabled={uploading} style={{ fontSize: 13, padding: "8px 16px" }}>
            {uploading ? m.uploading : m.uploadButton}
          </button>
          {url && (
            <button
              className="ghost-btn"
              type="button"
              disabled={removing}
              style={{ fontSize: 13, padding: "8px 16px" }}
              onClick={() => {
                const fd = new FormData();
                removeAction(fd);
              }}
            >
              {removing ? m.removing : m.removeButton}
            </button>
          )}
        </div>
      </form>

      {state.message && (
        <div className={state.ok ? "badge success" : "badge warning"} style={{ padding: "8px 12px", fontSize: 13 }}>
          {state.message}
        </div>
      )}
    </div>
  );
}
