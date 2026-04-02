"use client";

import { useActionState, useRef, useState } from "react";
import { uploadLogoImage, removeLogoImage } from "@/lib/settings/brand-upload-actions";

const initialState = { ok: false, message: "" };

export function LogoUpload({ currentUrl }: { currentUrl: string }) {
  const [url, setUrl] = useState(currentUrl);
  const [uploadState, uploadAction, uploading] = useActionState(uploadLogoImage, initialState);
  const [removeState, removeAction, removing] = useActionState(removeLogoImage, initialState);
  const fileRef = useRef<HTMLInputElement>(null);

  const state = uploadState.message ? uploadState : removeState;

  return (
    <div className="brand-form-section">
      <strong>Logo</strong>

      {url && (
        <div className="brand-logo-preview">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Logo preview" />
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
          Recommended: 200x60px, PNG or SVG. Max 2MB.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="primary-btn" type="submit" disabled={uploading} style={{ fontSize: 13, padding: "8px 16px" }}>
            {uploading ? "Uploading..." : "Upload Logo"}
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
                setUrl("");
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              {removing ? "Removing..." : "Remove"}
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
