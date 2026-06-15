"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { uploadSectionImage } from "@/lib/settings/brand-upload-actions";
import type { SettingsActionState } from "@/lib/settings/actions";
import type { StorefrontPageDocument } from "@/lib/storefront/page-document-schema";
import {
  setSectionSetting,
  setSectionSettingValue,
} from "@/lib/storefront/builder-document";
import {
  HERO_HEADLINE_MAX,
  HERO_MESSAGE_MAX,
  ABOUT_HEADING_MAX,
  ABOUT_BODY_MAX,
  TRUST_TITLE_MAX,
  TRUST_DESCRIPTION_MAX,
  TRUST_BADGES_MAX,
  TESTIMONIAL_NAME_MAX,
  TESTIMONIAL_TEXT_MAX,
  TESTIMONIALS_MAX,
  FAQ_QUESTION_MAX,
  FAQ_ANSWER_MAX,
  FAQ_ITEMS_MAX,
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

  // For the array-valued content sections (trust / testimonials / faq) we read
  // the current list defensively (anything non-array → empty) and write the
  // whole array back via setSectionSettingValue (empty array → key removed →
  // component falls back to today's behavior).
  const getList = <T,>(key: string): T[] =>
    Array.isArray(settings[key]) ? (settings[key] as T[]) : [];
  const setList = (key: string, value: unknown[]) =>
    onChange(setSectionSettingValue(doc, sectionId, key, value));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <p className="muted" style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
        {m.fallbackHint}
      </p>

      {type === "hero" && (
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
      )}

      {type === "about" && (
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

      {type === "trust" && (
        <TrustBadgesForm
          badges={getList<TrustBadgeValue>("badges")}
          onChange={(next) => setList("badges", next)}
        />
      )}

      {type === "testimonials" && (
        <TestimonialsForm
          items={getList<TestimonialValue>("items")}
          onChange={(next) => setList("items", next)}
        />
      )}

      {type === "faq" && (
        <FaqForm
          items={getList<FaqValue>("items")}
          onChange={(next) => setList("items", next)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PR-1d array-valued content forms (trust / testimonials / faq). Compact, like
// hero/about, rather than reusing the dashboard managers (those are bound to
// their own server actions + form-submit and can't be made controlled without
// risk). Each edits the section's `settings[key]` array on the shared builder
// document; the existing Save draft / Publish persists the whole document. An
// empty list removes the key → the section falls back to today's data source.
// ---------------------------------------------------------------------------

type TrustBadgeValue = { title: string; description: string };
type TestimonialValue = { name: string; text: string; rating?: number };
type FaqValue = { question: string; answer: string };

function TrustBadgesForm({
  badges,
  onChange,
}: {
  badges: TrustBadgeValue[];
  onChange: (next: TrustBadgeValue[]) => void;
}) {
  const { messages } = useI18n();
  const m = messages.dashboard.website.builder.sectionEditor;

  const update = (i: number, field: keyof TrustBadgeValue, value: string) =>
    onChange(badges.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)));
  const remove = (i: number) => onChange(badges.filter((_, idx) => idx !== i));
  const add = () => {
    if (badges.length >= TRUST_BADGES_MAX) return;
    onChange([...badges, { title: "", description: "" }]);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {badges.map((b, i) => (
        <div key={i} style={rowStyle}>
          <RowHeader title={`${i + 1}`} onRemove={() => remove(i)} removeLabel={m.removeRow} />
          <Field label={m.trustTitleLabel}>
            <input
              type="text"
              value={b.title}
              maxLength={TRUST_TITLE_MAX}
              placeholder={m.trustTitlePlaceholder}
              onChange={(e) => update(i, "title", e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label={m.trustDescriptionLabel}>
            <textarea
              value={b.description}
              maxLength={TRUST_DESCRIPTION_MAX}
              rows={2}
              placeholder={m.trustDescriptionPlaceholder}
              onChange={(e) => update(i, "description", e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
        </div>
      ))}
      {badges.length < TRUST_BADGES_MAX && (
        <AddButton label={m.trustAddBadge} onClick={add} />
      )}
    </div>
  );
}

function TestimonialsForm({
  items,
  onChange,
}: {
  items: TestimonialValue[];
  onChange: (next: TestimonialValue[]) => void;
}) {
  const { messages } = useI18n();
  const m = messages.dashboard.website.builder.sectionEditor;

  const update = (i: number, patch: Partial<TestimonialValue>) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => {
    if (items.length >= TESTIMONIALS_MAX) return;
    onChange([...items, { name: "", text: "" }]);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((it, i) => (
        <div key={i} style={rowStyle}>
          <RowHeader title={`${i + 1}`} onRemove={() => remove(i)} removeLabel={m.removeRow} />
          <Field label={m.testimonialNameLabel}>
            <input
              type="text"
              value={it.name}
              maxLength={TESTIMONIAL_NAME_MAX}
              placeholder={m.testimonialNamePlaceholder}
              onChange={(e) => update(i, { name: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label={m.testimonialTextLabel}>
            <textarea
              value={it.text}
              maxLength={TESTIMONIAL_TEXT_MAX}
              rows={3}
              placeholder={m.testimonialTextPlaceholder}
              onChange={(e) => update(i, { text: e.target.value })}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
          <Field label={m.testimonialRatingLabel}>
            <select
              value={it.rating ?? ""}
              onChange={(e) =>
                update(i, {
                  rating: e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
              style={inputStyle}
            >
              <option value="">{m.testimonialRatingNone}</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ))}
      {items.length < TESTIMONIALS_MAX && (
        <AddButton label={m.testimonialAdd} onClick={add} />
      )}
    </div>
  );
}

function FaqForm({
  items,
  onChange,
}: {
  items: FaqValue[];
  onChange: (next: FaqValue[]) => void;
}) {
  const { messages } = useI18n();
  const m = messages.dashboard.website.builder.sectionEditor;

  const update = (i: number, field: keyof FaqValue, value: string) =>
    onChange(items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => {
    if (items.length >= FAQ_ITEMS_MAX) return;
    onChange([...items, { question: "", answer: "" }]);
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {items.map((it, i) => (
        <div key={i} style={rowStyle}>
          <RowHeader title={`${i + 1}`} onRemove={() => remove(i)} removeLabel={m.removeRow} />
          <Field label={m.faqQuestionLabel}>
            <input
              type="text"
              value={it.question}
              maxLength={FAQ_QUESTION_MAX}
              placeholder={m.faqQuestionPlaceholder}
              onChange={(e) => update(i, "question", e.target.value)}
              style={inputStyle}
            />
          </Field>
          <Field label={m.faqAnswerLabel}>
            <textarea
              value={it.answer}
              maxLength={FAQ_ANSWER_MAX}
              rows={4}
              placeholder={m.faqAnswerPlaceholder}
              onChange={(e) => update(i, "answer", e.target.value)}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
        </div>
      ))}
      {items.length < FAQ_ITEMS_MAX && (
        <AddButton label={m.faqAdd} onClick={add} />
      )}
    </div>
  );
}

function RowHeader({
  title,
  onRemove,
  removeLabel,
}: {
  title: string;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text-soft)" }}>
        {title}
      </span>
      <button
        type="button"
        className="ghost-btn"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        style={{ color: "var(--danger)", fontSize: 13, padding: "4px 8px" }}
      >
        ✕
      </button>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="secondary-btn"
      onClick={onClick}
      style={{ fontSize: 13, padding: "8px 16px", justifySelf: "start" }}
    >
      {label}
    </button>
  );
}

const rowStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  border: "1px solid var(--border)",
  borderRadius: 10,
};

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
