"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/provider";
import type { ThemeTokens } from "@/lib/data/storefront-tokens-schema";
import type { StorefrontPageDocument } from "@/lib/storefront/page-document-schema";
import {
  isKnownSectionType,
  SECTION_REGISTRY,
  type SectionType,
} from "@/lib/storefront/sections/registry";
import {
  isAlwaysPresentSection,
  moveSection,
  toggleSectionDisabled,
  setDocumentTheme,
  addSection,
  removeSection,
  SECTION_COUNT_MAX,
} from "@/lib/storefront/builder-document";
import { isContentEditableSectionType } from "@/lib/storefront/sections/content-schemas";
import { StorefrontSectionEditor } from "@/components/settings/storefront-section-editor";
import {
  saveStorefrontDocumentDraft,
  publishStorefrontDocument,
  type StorefrontPageActionState,
} from "@/lib/settings/storefront-page-actions";
import { StorefrontTokenEditor } from "@/components/settings/storefront-token-editor";

const initialState: StorefrontPageActionState = { ok: false, message: "" };

type Tab = "sections" | "styles";

export function StorefrontBuilder({
  initialDocument,
  storefrontUrl,
}: {
  initialDocument: StorefrontPageDocument;
  storefrontUrl: string | null;
}) {
  const { messages } = useI18n();
  const m = messages.dashboard.website.builder;

  const [doc, setDoc] = useState<StorefrontPageDocument>(initialDocument);
  const [selectedId, setSelectedId] = useState<string>(
    initialDocument.order[0] ?? ""
  );
  const [tab, setTab] = useState<Tab>("sections");

  const [draftState, draftAction, draftPending] = useActionState(
    saveStorefrontDocumentDraft,
    initialState
  );
  const [publishState, publishAction, publishPending] = useActionState(
    publishStorefrontDocument,
    initialState
  );

  const documentJson = JSON.stringify(doc);
  const status = publishState.message ? publishState : draftState;

  const selectedType = doc.sections[selectedId]?.type;

  const labelForId = (id: string): string => {
    const section = doc.sections[id];
    const type = section?.type;
    // Reflect an edited hero headline in the lightweight section row so the
    // operator can see their copy without a full preview.
    if (type === "hero") {
      const headline = section?.settings?.headline;
      if (typeof headline === "string" && headline.trim()) {
        return headline.trim();
      }
    }
    if (type && isKnownSectionType(type)) {
      return SECTION_REGISTRY[type as SectionType].label;
    }
    return type ?? id;
  };

  const onMove = (id: string, dir: -1 | 1) => {
    const next = moveSection(doc, id, dir);
    if (next !== doc.order) setDoc({ ...doc, order: next });
  };
  const onToggle = (id: string) => setDoc(toggleSectionDisabled(doc, id));
  const onThemeChange = (theme: ThemeTokens) =>
    setDoc(setDocumentTheme(doc, theme));

  // The operator-addable custom types (registry `addable: true`), in registry
  // order, surfaced in the Add-section picker.
  const addableTypes = (
    Object.keys(SECTION_REGISTRY) as SectionType[]
  ).filter((t) => SECTION_REGISTRY[t].addable === true);

  const atSectionLimit = doc.order.length >= SECTION_COUNT_MAX;

  const onAdd = (type: SectionType) => {
    const next = addSection(doc, type);
    if (next === doc) return; // unknown type or at the cap → no-op
    setDoc(next);
    // addSection appends the new section to the end of `order`; select it.
    const newId = next.order[next.order.length - 1];
    setSelectedId(newId);
    setTab("sections");
  };

  const onRemove = (id: string) => {
    const next = removeSection(doc, id);
    if (next === doc) return; // alwaysPresent or unknown id → no-op
    setDoc(next);
    // If the removed section was selected, fall back to a remaining one.
    if (selectedId === id) {
      setSelectedId(next.order[0] ?? "");
    }
  };

  const selectedTheme = doc.theme as ThemeTokens | undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--bg, #fff)",
      }}
    >
      {/* ── Top bar (escapes the dashboard sidebar) ── */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "12px 20px",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/dashboard/website"
          className="secondary-btn"
          style={{ whiteSpace: "nowrap" }}
        >
          ← {m.backToDashboard}
        </Link>
        <strong style={{ fontSize: 15, flex: 1, minWidth: 120 }}>
          {m.title}
        </strong>

        {status.message && (
          <span
            className={status.ok ? "badge success" : "badge warning"}
            style={{ padding: "6px 12px" }}
          >
            {status.message}
          </span>
        )}

        {storefrontUrl && (
          <a
            href={storefrontUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="secondary-btn"
            style={{ whiteSpace: "nowrap" }}
          >
            {m.preview} &#8599;
          </a>
        )}

        <form action={draftAction}>
          <input type="hidden" name="document_json" value={documentJson} />
          <button type="submit" className="secondary-btn" disabled={draftPending}>
            {draftPending ? m.savingDraft : m.saveDraft}
          </button>
        </form>
        <form action={publishAction}>
          <input type="hidden" name="document_json" value={documentJson} />
          <button type="submit" className="primary-btn" disabled={publishPending}>
            {publishPending ? m.publishing : m.publish}
          </button>
        </form>
      </header>

      {/* ── Two-pane body ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)",
          flex: 1,
          minHeight: 0,
        }}
        className="storefront-builder-panes"
      >
        {/* Left = the section list / structure ("canvas"). */}
        <aside
          style={{
            borderRight: "1px solid var(--border)",
            overflowY: "auto",
            padding: 16,
          }}
        >
          <div className="kicker" style={{ marginBottom: 8 }}>
            {m.sectionsKicker}
          </div>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 12px", lineHeight: 1.5 }}>
            {m.sectionsHelp}
          </p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
            {doc.order.map((id, idx) => {
              const pinned = isAlwaysPresentSection(doc, id);
              const disabled = doc.sections[id]?.disabled === true;
              const isFirst = idx === 0;
              const isLast = idx === doc.order.length - 1;
              const selected = id === selectedId;
              return (
                <li key={id}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 12px",
                      border: selected
                        ? "1px solid var(--primary, #3F4A33)"
                        : "1px solid var(--border)",
                      borderRadius: 10,
                      background: disabled ? "var(--surface-muted)" : "var(--surface, #fff)",
                      opacity: disabled ? 0.6 : 1,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(id);
                        setTab("sections");
                      }}
                      style={{
                        flex: 1,
                        textAlign: "left",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 14,
                        padding: 0,
                      }}
                    >
                      {labelForId(id)}
                      {pinned && (
                        <span className="muted" style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
                          {m.pinnedTag}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onMove(id, -1)}
                      disabled={pinned || isFirst}
                      aria-label={m.moveUp}
                      title={m.moveUp}
                      className="icon-btn"
                      style={iconBtnStyle(pinned || isFirst)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onMove(id, 1)}
                      disabled={pinned || isLast}
                      aria-label={m.moveDown}
                      title={m.moveDown}
                      className="icon-btn"
                      style={iconBtnStyle(pinned || isLast)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggle(id)}
                      disabled={pinned}
                      aria-pressed={!disabled}
                      title={disabled ? m.show : m.hide}
                      className="icon-btn"
                      style={iconBtnStyle(pinned)}
                    >
                      {disabled ? m.show : m.hide}
                    </button>
                    {/* alwaysPresent sections (hero/closing) can't be removed —
                        hide the control entirely for them. */}
                    {!pinned && (
                      <button
                        type="button"
                        onClick={() => onRemove(id)}
                        aria-label={m.removeSection}
                        title={m.removeSection}
                        className="icon-btn"
                        style={iconBtnStyle(false)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Add-section picker — lists the addable custom types by label.
              Disabled at the section cap. */}
          <div style={{ marginTop: 16 }}>
            <label
              style={{ display: "grid", gap: 6, fontWeight: 600, fontSize: 13 }}
            >
              <span>{m.addSection}</span>
              <select
                value=""
                disabled={atSectionLimit}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value) onAdd(value as SectionType);
                  // Reset back to the placeholder so the same type can be
                  // re-added without first picking another option.
                  e.target.value = "";
                }}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 14,
                  fontFamily: "inherit",
                  background: "var(--surface, #fff)",
                  color: "var(--text, #1A1A1A)",
                  opacity: atSectionLimit ? 0.5 : 1,
                }}
              >
                <option value="">{m.addSectionPlaceholder}</option>
                {addableTypes.map((t) => (
                  <option key={t} value={t}>
                    {SECTION_REGISTRY[t].label}
                  </option>
                ))}
              </select>
            </label>
            {atSectionLimit && (
              <p
                className="muted"
                style={{ fontSize: 12, margin: "6px 0 0", lineHeight: 1.5 }}
              >
                {m.sectionLimitReached}
              </p>
            )}
          </div>
        </aside>

        {/* Right = tabs (Sections / Styles). */}
        <section style={{ overflowY: "auto", padding: 24 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "1px solid var(--border)" }}>
            <TabButton active={tab === "sections"} onClick={() => setTab("sections")}>
              {m.tabSections}
            </TabButton>
            <TabButton active={tab === "styles"} onClick={() => setTab("styles")}>
              {m.tabStyles}
            </TabButton>
          </div>

          {tab === "sections" ? (
            <div style={{ maxWidth: 520 }}>
              <h2 style={{ margin: "0 0 16px", fontSize: 18 }}>
                {selectedId ? labelForId(selectedId) : m.tabSections}
              </h2>
              {selectedType && isContentEditableSectionType(selectedType) ? (
                <StorefrontSectionEditor
                  // Remount on section switch so per-section local form state
                  // (e.g. the gallery's working rows) starts fresh.
                  key={selectedId}
                  type={selectedType}
                  sectionId={selectedId}
                  doc={doc}
                  onChange={setDoc}
                />
              ) : (
                <p className="muted" style={{ lineHeight: 1.6 }}>
                  {m.contentComingSoon}
                </p>
              )}
            </div>
          ) : selectedTheme ? (
            <StorefrontTokenEditor tokens={selectedTheme} onChange={onThemeChange} />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--surface, #fff)",
    padding: "4px 8px",
    fontSize: 13,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.4 : 1,
    whiteSpace: "nowrap",
  };
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        borderBottom: active ? "2px solid var(--primary, #3F4A33)" : "2px solid transparent",
        padding: "8px 4px",
        marginBottom: -1,
        fontWeight: 600,
        fontSize: 14,
        color: active ? "var(--text, #1A1A1A)" : "var(--text-muted, #5C5651)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
