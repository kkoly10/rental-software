"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { uploadLogoImage, removeLogoImage } from "@/lib/settings/brand-upload-actions";
import type { SettingsActionState } from "@/lib/settings/actions";
import { useI18n } from "@/lib/i18n/provider";

const initialState: SettingsActionState = { ok: false, message: "" };

export function LogoUpload({ currentUrl }: { currentUrl: string }) {
  const { messages: m } = useI18n();
  const [url, setUrl] = useState(currentUrl);
  const [uploadState, uploadAction, uploading] = useActionState(uploadLogoImage, initialState);
  const [removeState, removeAction, removing] = useActionState(removeLogoImage, initialState);
  const fileRef = useRef<HTMLInputElement>(null);

  // Update preview and clear file input when upload succeeds.
  useEffect(() => {
    if (uploadState.ok && uploadState.url) {
      setUrl(uploadState.url);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [uploadState]);

  // Only clear the preview once the server confirms removal.
  useEffect(() => {
    if (removeState.ok && removeState.message) {
      setUrl("");
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [removeState]);

  const state = removing || removeState.message ? removeState : uploadState;

  return (
    <div className="brand-form-section">
      <strong>{m.logoUpload.label}</strong>

      {url && (
        <div className="brand-logo-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={m.logoUpload.altPreview} />
        </div>
      )}

      <form action={uploadAction} style={{ marginTop: 8 }}>
        <input
          ref={fileRef}
          name="logo_file"
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          style={{ fontSize: 13 }}
        />
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {m.logoUpload.recommended}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="primary-btn" type="submit" disabled={uploading} style={{ fontSize: 13, padding: "8px 16px" }}>
            {uploading ? m.logoUpload.uploading : m.logoUpload.upload}
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
              {removing ? m.logoUpload.removing : m.logoUpload.remove}
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
