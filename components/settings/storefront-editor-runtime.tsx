"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  isContentEditableSectionType,
  type ContentEditableSectionType,
} from "@/lib/storefront/sections/content-schemas";
import { StorefrontSectionEditor } from "@/components/settings/storefront-section-editor";
import { StorefrontTokenEditor } from "@/components/settings/storefront-token-editor";
import {
  saveStorefrontDocumentDraft,
  publishStorefrontDocument,
  type StorefrontPageActionState,
} from "@/lib/settings/storefront-page-actions";

const initialState: StorefrontPageActionState = { ok: false, message: "" };

/** Document-space rectangle of a section, used to position overlay frames. */
type Frame = { top: number; left: number; width: number; height: number };

/**
 * On-canvas editor runtime (PR-2a). The storefront itself is server-rendered as
 * the page (with `renderDocumentSections({ editable: true })` wrapping each
 * section in a `[data-st-section-id]` marker). This client overlay does NOT
 * render the storefront — it READS those markers from the DOM to draw a fixed
 * top bar, hover/selection frames, a floating per-section toolbar, and the
 * existing content/styles editors in a drawer.
 *
 * Structural ops (move/hide/delete) are applied optimistically to the live DOM
 * for instant feedback, then the resulting document is debounce-saved to the
 * DRAFT (never the live site — Publish is the only path that goes live). Adds and
 * content edits need a server re-render, so they save then router.refresh().
 */
export function StorefrontEditorRuntime({
  initialDocument,
  storefrontUrl,
}: {
  initialDocument: StorefrontPageDocument;
  storefrontUrl: string | null;
}) {
  const { messages } = useI18n();
  const m = messages.dashboard.website.builder;
  const router = useRouter();

  const [doc, setDoc] = useState<StorefrontPageDocument>(initialDocument);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);

  // Frames are stored in document coordinates (scrollY + getBoundingClientRect)
  // so they stay glued to a section while the page scrolls.
  const [frames, setFrames] = useState<Record<string, Frame>>({});

  const [draftState, draftAction, draftPending] = useActionState(
    saveStorefrontDocumentDraft,
    initialState
  );
  const [publishState, publishAction, publishPending] = useActionState(
    publishStorefrontDocument,
    initialState
  );
  const status = publishState.message ? publishState : draftState;

  const documentJson = JSON.stringify(doc);

  // Keep the latest doc JSON in a ref so DOM event handlers + timers always save
  // the current document without being re-bound on every keystroke.
  const docJsonRef = useRef(documentJson);
  docJsonRef.current = documentJson;

  // ── Background draft save (debounced) ───────────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDraftNow = useCallback(async () => {
    setAutoSaving(true);
    try {
      const formData = new FormData();
      formData.set("document_json", docJsonRef.current);
      await saveStorefrontDocumentDraft(initialState, formData);
    } catch {
      // Best-effort; the manual Save draft / Publish buttons remain reliable.
    } finally {
      setAutoSaving(false);
    }
  }, []);
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveDraftNow();
    }, 1200);
  }, [saveDraftNow]);

  // Persist content/theme edits (doc changes) on a debounce. Skip the very first
  // render: the initial document already matches what the server rendered.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    scheduleSave();
  }, [documentJson, scheduleSave]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // ── Section measurement (frames) ────────────────────────────────────────────
  const measure = useCallback(() => {
    const nodes = document.querySelectorAll<HTMLElement>(
      "[data-st-section-id]"
    );
    const next: Record<string, Frame> = {};
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    nodes.forEach((node) => {
      const id = node.dataset.stSectionId;
      if (!id) return;
      const rect = node.getBoundingClientRect();
      next[id] = {
        top: rect.top + scrollY,
        left: rect.left + scrollX,
        width: rect.width,
        height: rect.height,
      };
    });
    setFrames(next);
  }, []);

  // Measure on mount + whenever the doc structure changes, and on scroll/resize
  // (rAF-throttled). A ResizeObserver catches async content reflow (images, etc).
  useEffect(() => {
    measure();
    let raf = 0;
    const onScrollResize = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    window.addEventListener("scroll", onScrollResize, { passive: true });
    window.addEventListener("resize", onScrollResize);

    const ro = new ResizeObserver(onScrollResize);
    document
      .querySelectorAll<HTMLElement>("[data-st-section-id]")
      .forEach((node) => ro.observe(node));

    return () => {
      window.removeEventListener("scroll", onScrollResize);
      window.removeEventListener("resize", onScrollResize);
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // doc.order length / membership changes can add/remove section nodes.
  }, [measure, doc.order]);

  // ── Hover tracking ──────────────────────────────────────────────────────────
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const section = target?.closest<HTMLElement>("[data-st-section-id]");
      const id = section?.dataset.stSectionId ?? null;
      setHoverId((prev) => (prev === id ? prev : id));
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  // ── Selection ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      // Ignore clicks inside the editor chrome (top bar, frames, drawers).
      if (target?.closest("[data-st-editor-chrome]")) return;
      const section = target?.closest<HTMLElement>("[data-st-section-id]");
      if (!section) return;
      // Don't hijack navigation/interactions inside a section unless it's a
      // plain element click — selecting is the primary intent on the canvas.
      e.preventDefault();
      const id = section.dataset.stSectionId ?? null;
      setSelectedId(id);
    };
    const onDouble = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-st-editor-chrome]")) return;
      const section = target?.closest<HTMLElement>("[data-st-section-id]");
      const id = section?.dataset.stSectionId;
      if (id) openEditor(id);
    };
    document.addEventListener("click", onClick);
    document.addEventListener("dblclick", onDouble);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("dblclick", onDouble);
    };
    // openEditor is stable enough (only reads doc via closure on call).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Labels (mirror the old builder's labelForId) ────────────────────────────
  const labelForId = useCallback(
    (id: string): string => {
      const section = doc.sections[id];
      const type = section?.type;
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
    },
    [doc]
  );

  // ── DOM helpers for optimistic structural ops ───────────────────────────────
  const sectionNode = (id: string) =>
    document.querySelector<HTMLElement>(`[data-st-section-id="${id}"]`);

  // ── Structural ops ──────────────────────────────────────────────────────────
  const onMove = useCallback(
    (id: string, dir: -1 | 1) => {
      const nextOrder = moveSection(doc, id, dir);
      if (nextOrder === doc.order) return;
      // Optimistic DOM reorder for instant feedback.
      const node = sectionNode(id);
      const parent = node?.parentElement;
      if (node && parent) {
        const swapId = nextOrder[nextOrder.indexOf(id) + (dir === -1 ? 1 : -1)];
        const swapNode = swapId ? sectionNode(swapId) : null;
        if (swapNode) {
          if (dir === -1) parent.insertBefore(node, swapNode);
          else parent.insertBefore(swapNode, node);
        }
      }
      setDoc({ ...doc, order: nextOrder });
      requestAnimationFrame(measure);
      scheduleSave();
    },
    [doc, measure, scheduleSave]
  );

  const onToggle = useCallback(
    (id: string) => {
      const next = toggleSectionDisabled(doc, id);
      if (next === doc) return;
      // Use the SAME data-st-disabled attribute the server render greys on, so
      // toggling reconciles with a section that was already disabled at render
      // time (a separate .is-hidden class would double-grey on enable and never
      // clear the server's attribute).
      const nowDisabled = next.sections[id]?.disabled === true;
      const node = sectionNode(id);
      if (node) {
        if (nowDisabled) node.setAttribute("data-st-disabled", "true");
        else node.removeAttribute("data-st-disabled");
      }
      setDoc(next);
      scheduleSave();
    },
    [doc, scheduleSave]
  );

  const onRemove = useCallback(
    (id: string) => {
      const next = removeSection(doc, id);
      if (next === doc) return;
      const node = sectionNode(id);
      if (node) node.style.display = "none";
      setDoc(next);
      if (selectedId === id) setSelectedId(null);
      if (editingId === id) setEditingId(null);
      requestAnimationFrame(measure);
      scheduleSave();
    },
    [doc, selectedId, editingId, measure, scheduleSave]
  );

  // Add: needs a server render of the new section → save then refresh.
  const addableTypes = (
    Object.keys(SECTION_REGISTRY) as SectionType[]
  ).filter((t) => SECTION_REGISTRY[t].addable === true);
  const atSectionLimit = doc.order.length >= SECTION_COUNT_MAX;

  const onAdd = useCallback(
    async (type: SectionType) => {
      const next = addSection(doc, type);
      if (next === doc) return;
      setAddMenuOpen(false);
      const newId = next.order[next.order.length - 1];
      setDoc(next);
      // Persist before refreshing so the server renders the new section.
      const formData = new FormData();
      formData.set("document_json", JSON.stringify(next));
      setAutoSaving(true);
      try {
        const result = await saveStorefrontDocumentDraft(initialState, formData);
        if (result.ok) {
          router.refresh();
          // After the refresh paints, select + measure the new section.
          setSelectedId(newId);
          requestAnimationFrame(() => requestAnimationFrame(measure));
        }
      } finally {
        setAutoSaving(false);
      }
    },
    [doc, router, measure]
  );

  // ── Content editor drawer ───────────────────────────────────────────────────
  const editingDocAtOpen = useRef<string | null>(null);
  const openEditor = useCallback(
    (id: string) => {
      setSelectedId(id);
      setStylesOpen(false);
      setEditingId(id);
      editingDocAtOpen.current = JSON.stringify(doc.sections[id] ?? null);
    },
    [doc]
  );
  const closeEditor = useCallback(() => {
    const id = editingId;
    setEditingId(null);
    if (!id) return;
    // If the section's content actually changed, save then refresh so the canvas
    // reflects it (inline live text editing is a later PR).
    const afterJson = JSON.stringify(doc.sections[id] ?? null);
    if (afterJson !== editingDocAtOpen.current) {
      void (async () => {
        await saveDraftNow();
        router.refresh();
        requestAnimationFrame(() => requestAnimationFrame(measure));
      })();
    }
  }, [editingId, doc, saveDraftNow, router, measure]);

  // ── Render-time derived values ──────────────────────────────────────────────
  const selectedType = selectedId ? doc.sections[selectedId]?.type : undefined;
  const editingType = editingId ? doc.sections[editingId]?.type : undefined;
  const selectedPinned = selectedId
    ? isAlwaysPresentSection(doc, selectedId)
    : false;
  const selectedIdx = selectedId ? doc.order.indexOf(selectedId) : -1;
  const selectedDisabled = selectedId
    ? doc.sections[selectedId]?.disabled === true
    : false;

  const hoverFrame = hoverId ? frames[hoverId] : undefined;
  const selFrame = selectedId ? frames[selectedId] : undefined;

  const theme = doc.theme as ThemeTokens | undefined;

  return (
    <>
      {/* ── Fixed top bar ── */}
      <header className="st-editor-topbar" data-st-editor-chrome>
        <Link href="/dashboard/website" className="secondary-btn">
          &larr; {m.backToDashboard}
        </Link>
        <span className="st-editor-title">{m.title}</span>

        <button
          type="button"
          className="secondary-btn"
          onClick={() => {
            setStylesOpen((v) => !v);
            setEditingId(null);
          }}
        >
          {m.styles}
        </button>

        <div className="st-editor-addmenu-wrap">
          <button
            type="button"
            className="secondary-btn"
            disabled={atSectionLimit}
            onClick={() => setAddMenuOpen((v) => !v)}
          >
            + {m.addSection}
          </button>
          {addMenuOpen && !atSectionLimit && (
            <div className="st-editor-addmenu">
              {addableTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    void onAdd(t);
                  }}
                >
                  {SECTION_REGISTRY[t].label}
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="st-editor-spacer" />

        {autoSaving && <span className="st-editor-badge">{m.savingDraft}</span>}
        {!autoSaving && status.message && (
          <span
            className={`st-editor-badge ${status.ok ? "is-success" : "is-error"}`}
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

      {/* ── Hover frame (hidden while a drawer is open or over the selection) ── */}
      {hoverFrame && hoverId !== selectedId && !editingId && !stylesOpen && (
        <div
          className="st-editor-hoverframe"
          data-st-editor-chrome
          style={{
            top: hoverFrame.top,
            left: hoverFrame.left,
            width: hoverFrame.width,
            height: hoverFrame.height,
          }}
        >
          <span className="st-editor-frame-label">{labelForId(hoverId!)}</span>
        </div>
      )}

      {/* ── Selection frame + floating toolbar ── */}
      {selFrame && selectedId && (
        <>
          <div
            className="st-editor-selframe"
            data-st-editor-chrome
            style={{
              top: selFrame.top,
              left: selFrame.left,
              width: selFrame.width,
              height: selFrame.height,
            }}
          >
            <span className="st-editor-frame-label">
              {labelForId(selectedId)}
            </span>
          </div>
          <div
            className="st-editor-toolbar"
            data-st-editor-chrome
            style={{
              top: selFrame.top + 6,
              left: Math.max(8, selFrame.left + selFrame.width - 220),
            }}
          >
            <button
              type="button"
              title={m.moveUp}
              aria-label={m.moveUp}
              disabled={selectedPinned || selectedIdx <= 0}
              onClick={() => onMove(selectedId, -1)}
            >
              &uarr;
            </button>
            <button
              type="button"
              title={m.moveDown}
              aria-label={m.moveDown}
              disabled={selectedPinned || selectedIdx >= doc.order.length - 1}
              onClick={() => onMove(selectedId, 1)}
            >
              &darr;
            </button>
            <button
              type="button"
              title={selectedDisabled ? m.show : m.hide}
              aria-label={selectedDisabled ? m.show : m.hide}
              aria-pressed={!selectedDisabled}
              disabled={selectedPinned}
              onClick={() => onToggle(selectedId)}
            >
              {selectedDisabled ? "\u{1F441}‍\u{1F5E8}" : "\u{1F441}"}
            </button>
            {!selectedPinned && (
              <button
                type="button"
                title={m.removeSection}
                aria-label={m.removeSection}
                onClick={() => onRemove(selectedId)}
              >
                &#10005;
              </button>
            )}
            <span className="st-editor-toolbar-sep" />
            <button
              type="button"
              className="st-editor-toolbar-edit"
              onClick={() => openEditor(selectedId)}
            >
              &#9998; {m.editContent}
            </button>
          </div>
        </>
      )}

      {/* ── Content editor drawer ── */}
      {editingId && (
        <aside className="st-editor-drawer" data-st-editor-chrome>
          <div className="st-editor-drawer-header">
            <h2>{m.editContentTitle}</h2>
            <button
              type="button"
              className="st-editor-drawer-close"
              aria-label={m.doneEditing}
              title={m.doneEditing}
              onClick={closeEditor}
            >
              &#10005;
            </button>
          </div>
          <div className="st-editor-drawer-body">
            {editingType && isContentEditableSectionType(editingType) ? (
              <>
                <p className="st-editor-drawer-note">{m.autosaveRefreshNote}</p>
                <StorefrontSectionEditor
                  key={editingId}
                  type={editingType as ContentEditableSectionType}
                  sectionId={editingId}
                  doc={doc}
                  onChange={setDoc}
                />
              </>
            ) : (
              <p className="st-editor-drawer-note">{m.noEditableContent}</p>
            )}
          </div>
        </aside>
      )}

      {/* ── Styles drawer ── */}
      {stylesOpen && theme && (
        <aside className="st-editor-drawer" data-st-editor-chrome>
          <div className="st-editor-drawer-header">
            <h2>{m.stylesPanelTitle}</h2>
            <button
              type="button"
              className="st-editor-drawer-close"
              aria-label={m.doneEditing}
              title={m.doneEditing}
              onClick={() => setStylesOpen(false)}
            >
              &#10005;
            </button>
          </div>
          <div className="st-editor-drawer-body">
            <StorefrontTokenEditor
              tokens={theme}
              onChange={(next) => setDoc(setDocumentTheme(doc, next))}
            />
          </div>
        </aside>
      )}
    </>
  );
}
