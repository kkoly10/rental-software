"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { uploadSectionImage } from "@/lib/settings/brand-upload-actions";
import type { SettingsActionState } from "@/lib/settings/actions";
import type { StorefrontPageDocument } from "@/lib/storefront/page-document-schema";
import { setSectionSetting } from "@/lib/storefront/builder-document";
import {
  HERO_HEADLINE_MAX,
  HERO_MESSAGE_MAX,
  ABOUT_HEADING_MAX,
  ABOUT_BODY_MAX,
  type ContentEditableSectionType,
} from "@/lib/storefront/sections/content-schemas";

const initialUploadState: SettingsActionState = { ok: false, message: "" };

/**
 * PR-1c content editor for the two editable section types (hero + about). It
 * reads/writes the selected section's `settings` ON the shared builder document
 * via setSectionSetting, so the existing whole-document Save draft / Publish
 * persists it (no new write action). Empty fields delete the key → the section
 * component falls back to today's behavior (byte-for-byte safety).
 */
export function StorefrontSectionEditor({
  type,
  sectionId,
  doc,
  onChange,
}: {
  type: ContentEditableSectionType;
  sectionId: string;
  doc: StorefrontPageDocument;
  onChange: (next: StorefrontPageDocument) => void;
}) {
  const { messages } = useI18n();
  const m = messages.dashboard.website.builder.sectionEditor;

  const settings = (doc.sections[sectionId]?.settings ?? {}) as Record<
    string,
    unknown
  >;
  const get = (key: string): string =>
    typeof settings[key] === "string" ? (settings[key] as string) : "";

  const set = (key: string, value: string) =>
    onChange(setSectionSetting(doc, sectionId, key, value));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p className="muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
        {m.fallbackHint}
      </p>

      {type === "hero" ? (
        <>
          <Field label={m.heroHeadlineLabel}>
            <input
              type="text"
              value={get("headline")}
              maxLength={HERO_HEADLINE_MAX}
              placeholder={m.heroHeadlinePlaceholder}
              onChange={(e) => set("headline", e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label={m.heroMessageLabel}>
            <textarea
              value={get("message")}
              maxLength={HERO_MESSAGE_MAX}
              rows={3}
              placeholder={m.heroMessagePlaceholder}
              onChange={(e) => set("message", e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>

          <Field label={m.heroImageLabel}>
            <SectionImageField
              currentUrl={get("imageUrl")}
              onUrlChange={(url) => set("imageUrl", url)}
            />
          </Field>
        </>
      ) : (
        <>
          <Field label={m.aboutHeadingLabel}>
            <input
              type="text"
              value={get("heading")}
              maxLength={ABOUT_HEADING_MAX}
              placeholder={m.aboutHeadingPlaceholder}
              onChange={(e) => set("heading", e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label={m.aboutBodyLabel}>
            <textarea
              value={get("body")}
              maxLength={ABOUT_BODY_MAX}
              rows={8}
              placeholder={m.aboutBodyPlaceholder}
              onChange={(e) => set("body", e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
        </>
      )}
    </div>
  );
}

/**
 * Hero image upload: reuses the sniffed + EXIF-stripped upload pipeline via the
 * uploadSectionImage server action. On success the returned public URL is
 * written into settings.imageUrl (the document), not org settings. Removing
 * clears the field so the hero falls back to the default image.
 */
function SectionImageField({
  currentUrl,
  onUrlChange,
}: {
  currentUrl: string;
  onUrlChange: (url: string) => void;
}) {
  const { messages } = useI18n();
  const m = messages.dashboard.website.builder.sectionEditor;
  const [uploadState, uploadAction, uploading] = useActionState(
    uploadSectionImage,
    initialUploadState
  );
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (uploadState.ok && uploadState.url) {
      onUrlChange(uploadState.url);
      if (fileRef.current) fileRef.current.value = "";
    }
    // onUrlChange is stable enough for this effect's intent (fire on upload).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadState]);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {currentUrl && (
        <div style={{ borderRadius: 10, overflow: "hidden", maxHeight: 160 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt={m.imageAltPreview}
            style={{ width: "100%", height: 160, objectFit: "cover" }}
          />
        </div>
      )}

      <form action={uploadAction}>
        <input
          ref={fileRef}
          name="section_image_file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label={m.heroImageLabel}
          style={{ fontSize: 13 }}
        />
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
          {m.imageHelp}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            className="secondary-btn"
            type="submit"
            disabled={uploading}
            style={{ fontSize: 13, padding: "8px 16px" }}
          >
            {uploading ? m.imageUploading : m.imageUploadButton}
          </button>
          {currentUrl && (
            <button
              className="ghost-btn"
              type="button"
              style={{ fontSize: 13, padding: "8px 16px" }}
              onClick={() => onUrlChange("")}
            >
              {m.imageRemove}
            </button>
          )}
        </div>
      </form>

      {uploadState.message && (
        <div
          className={uploadState.ok ? "badge success" : "badge warning"}
          style={{ padding: "8px 12px", fontSize: 13 }}
        >
          {uploadState.message}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 14,
  fontFamily: "inherit",
  background: "var(--surface, #fff)",
  color: "var(--text, #1A1A1A)",
};
