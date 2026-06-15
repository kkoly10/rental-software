"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
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
  setSectionSetting,
  SECTION_COUNT_MAX,
} from "@/lib/storefront/builder-document";
import { uploadSectionImage } from "@/lib/settings/brand-upload-actions";
import {
  isContentEditableSectionType,
  type ContentEditableSectionType,
} from "@/lib/storefront/sections/content-schemas";
import { StorefrontSectionEditor } from "@/components/settings/storefront-section-editor";
import { StorefrontTokenEditor } from "@/components/settings/storefront-token-editor";
import { EditorTooltip } from "@/components/settings/editor-tooltip";
import { EditorTour, hasSeenTour, type TourStep } from "@/components/settings/editor-tour";
import {
  IconArrowUp,
  IconArrowDown,
  IconEye,
  IconEyeOff,
  IconTrash,
  IconPencil,
  IconHelp,
  IconImage,
  IconClose,
} from "@/components/settings/editor-icons";
import {
  saveStorefrontDocumentDraft,
  publishStorefrontDocument,
  type StorefrontPageActionState,
} from "@/lib/settings/storefront-page-actions";

const initialState: StorefrontPageActionState = { ok: false, message: "" };

/** Document-space rectangle of a section, used to position overlay frames. */
type Frame = { top: number; left: number; width: number; height: number };

/**
 * Section-type → inline-editable text field map (PR-2b). Drives type-on-the-page
 * editing entirely from the runtime: for each `[data-st-section-id]` wrapper we
 * read its `data-st-section-type`, look up the field list here, and bind the
 * matching server-rendered DOM node (found by `selector`, scoped to that
 * wrapper) as a contentEditable surface. The selectors mirror the shared section
 * components' static class names — those components are NOT touched (HARD
 * CONSTRAINT) so the public render stays byte-for-byte identical.
 */
const INLINE_TEXT_FIELDS: Record<
  string,
  { field: string; selector: string; multiline: boolean; max: number }[]
> = {
  hero: [
    { field: "headline", selector: ".st-h1", multiline: false, max: 120 },
    { field: "message", selector: ".st-lede", multiline: true, max: 300 },
  ],
  about: [
    { field: "heading", selector: ".st-section-title", multiline: false, max: 120 },
    { field: "body", selector: ".st-about-body", multiline: true, max: 4000 },
  ],
  "custom-rich": [
    { field: "heading", selector: ".st-section-title", multiline: false, max: 120 },
    { field: "body", selector: ".st-section-sub", multiline: true, max: 4000 },
  ],
};

/**
 * Section-type → on-canvas image-replace target (PR-2b). For a SELECTED section
 * of one of these types, the runtime renders a "Replace image" overlay button
 * positioned over the image region (located via `selector`, scoped to the
 * section wrapper). The picked file is uploaded via uploadSectionImage and the
 * resulting URL written to `sections[id].settings.imageUrl`.
 */
const INLINE_IMAGE_FIELDS: Record<
  string,
  { field: string; selector: string }
> = {
  hero: { field: "imageUrl", selector: ".st-hero-photo" },
  "custom-image": { field: "imageUrl", selector: "figure" },
};

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
  const tips = m.tips;
  const router = useRouter();

  const [doc, setDoc] = useState<StorefrontPageDocument>(initialDocument);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [stylesOpen, setStylesOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);

  // True while an inline contentEditable field has focus — suppresses the hover
  // frame so the dashed/solid outlines don't fight the caret.
  const [inlineEditing, setInlineEditing] = useState(false);

  // ── Editor guidance (PR-2d) ─────────────────────────────────────────────────
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  // Becomes true once the operator has inline-edited at least once; used to
  // auto-hide the canvas hint bar.
  const [hasInlineEdited, setHasInlineEdited] = useState(false);
  // Whether the canvas inline-text hint has been dismissed (persisted).
  const [inlineHintDismissed, setInlineHintDismissed] = useState(true);
  const helpMenuRef = useRef<HTMLDivElement | null>(null);

  // On-canvas image replace (PR-2b): one upload in flight at a time.
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // ── Editor guidance: first-run tour + persisted hint state (PR-2d) ───────────
  const INLINE_HINT_KEY = "korent.builder.hint.inlineText.v1";
  useEffect(() => {
    // Auto-open the guided tour the first time the editor is opened.
    if (!hasSeenTour()) setTourOpen(true);
    // Restore canvas hint-bar dismissal.
    if (typeof window !== "undefined") {
      try {
        setInlineHintDismissed(
          window.localStorage.getItem(INLINE_HINT_KEY) === "1"
        );
      } catch {
        setInlineHintDismissed(true);
      }
    }
  }, []);

  const dismissInlineHint = useCallback(() => {
    setInlineHintDismissed(true);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(INLINE_HINT_KEY, "1");
      } catch {
        /* best-effort */
      }
    }
  }, []);

  // Close the Help menu on outside click / Escape.
  useEffect(() => {
    if (!helpOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!helpMenuRef.current?.contains(e.target as Node)) setHelpOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [helpOpen]);

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

  // ── Inline (type-on-the-page) text editing (PR-2b) ──────────────────────────
  // Bind each section's editable text node (resolved from INLINE_TEXT_FIELDS,
  // scoped to its [data-st-section-id] wrapper) as a contentEditable surface.
  // These are server-rendered STATIC nodes (no React ownership on this page), so
  // mutating them directly is safe. Binding is idempotent (skips nodes already
  // carrying data-st-inline-field) so it can re-run after every canvas refresh.
  const bindInlineFields = useCallback(() => {
    const wrappers = document.querySelectorAll<HTMLElement>(
      "[data-st-section-id]"
    );
    wrappers.forEach((wrapper) => {
      const sectionId = wrapper.dataset.stSectionId;
      const type = wrapper.dataset.stSectionType;
      if (!sectionId || !type) return;
      const fields = INLINE_TEXT_FIELDS[type];
      if (!fields) return;

      for (const { field, selector, multiline, max } of fields) {
        const el = wrapper.querySelector<HTMLElement>(selector);
        if (!el) continue;
        if (el.dataset.stInlineField) continue; // already bound

        el.dataset.stInlineField = field;
        el.dataset.stInlineSection = sectionId;
        el.classList.add("st-inline-editable");
        // plaintext-only avoids pasted HTML landing in the contentEditable;
        // fall back to "true" where the browser doesn't support it.
        el.contentEditable = "plaintext-only";
        if (el.contentEditable !== "plaintext-only") {
          el.contentEditable = "true";
        }
        el.spellcheck = true;

        el.addEventListener("focus", () => {
          setSelectedId(sectionId);
          setInlineEditing(true);
          // Inline editing was discovered → retire the canvas hint bar.
          setHasInlineEdited(true);
        });

        el.addEventListener("keydown", (e: KeyboardEvent) => {
          if (!multiline && e.key === "Enter") {
            // Single-line field: Enter commits (blur), never inserts a newline.
            e.preventDefault();
            el.blur();
          }
        });

        el.addEventListener("blur", () => {
          setInlineEditing(false);
          // Normalize: collapse NBSPs, trim, clamp to the schema max. Stored as
          // PLAIN text (innerText) so no markup can ride into the document.
          let value = el.innerText.replace(/ /g, " ").trim();
          if (value.length > max) value = value.slice(0, max);
          // setSectionSetting REMOVES the key when value is "" → falls back to
          // the component default. The debounced save fires from the doc effect.
          setDoc((prev) => setSectionSetting(prev, sectionId, field, value));
        });
      }
    });
  }, []);

  useEffect(() => {
    bindInlineFields();

    // Re-bind + re-measure whenever the canvas DOM is replaced (router.refresh
    // from add-section / image replace / content-drawer close swaps the
    // server-rendered subtree). rAF-debounced so a burst of childList mutations
    // triggers a single pass.
    const root =
      document.querySelector<HTMLElement>(".st-editor-canvas") ??
      document.getElementById("main");
    if (!root) return;

    let raf = 0;
    const observer = new MutationObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        bindInlineFields();
        measure();
      });
    });
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [bindInlineFields, measure]);

  // ── On-canvas image replace (PR-2b) ─────────────────────────────────────────
  // Trigger a hidden file input scoped to the selected section's image field.
  const pendingImageSectionRef = useRef<string | null>(null);
  const onReplaceImageClick = useCallback((sectionId: string) => {
    if (uploadingImage) return;
    pendingImageSectionRef.current = sectionId;
    fileInputRef.current?.click();
  }, [uploadingImage]);

  const onImageFilePicked = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const file = input.files?.[0];
      const sectionId = pendingImageSectionRef.current;
      // Reset the input so picking the same file again still fires change.
      input.value = "";
      pendingImageSectionRef.current = null;
      if (!file || !sectionId || uploadingImage) return;

      setUploadingImage(true);
      setImageUploadError(null);
      try {
        const formData = new FormData();
        formData.set("section_image_file", file);
        const result = await uploadSectionImage(initialState, formData);
        if (!result.ok || !result.url) {
          setImageUploadError(result.message || m.imageUploadFailed);
          return;
        }
        const url = result.url;
        // Write into the draft document; refresh so the server re-renders the
        // image (next/image srcset makes an optimistic DOM swap unreliable).
        setDoc((prev) => setSectionSetting(prev, sectionId, "imageUrl", url));
        const fd = new FormData();
        fd.set(
          "document_json",
          JSON.stringify(setSectionSetting(doc, sectionId, "imageUrl", url))
        );
        await saveStorefrontDocumentDraft(initialState, fd);
        router.refresh();
        requestAnimationFrame(() => requestAnimationFrame(measure));
      } catch {
        setImageUploadError(m.imageUploadFailed);
      } finally {
        setUploadingImage(false);
      }
    },
    [uploadingImage, doc, router, measure, m.imageUploadFailed]
  );

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
      // Ignore clicks inside an inline contentEditable field: let native caret
      // placement happen (no preventDefault, no reselect). The field's `focus`
      // handler performs the selection.
      if (target?.closest("[data-st-inline-field]")) return;
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
      // Inside an inline field, double-click is word-select — don't open the drawer.
      if (target?.closest("[data-st-inline-field]")) return;
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

  // On-canvas image replace (PR-2b): does the selected section have a replaceable
  // image? If so, position a "Replace image" overlay over its image region. We
  // locate the image element by its INLINE_IMAGE_FIELDS selector (scoped to the
  // section wrapper) and convert its rect into the same document-space coords as
  // the frames so it stays glued through scroll.
  const selectedImageFrame: Frame | undefined = (() => {
    if (!selectedId || !selFrame) return undefined;
    const type = selectedType;
    if (!type || !INLINE_IMAGE_FIELDS[type]) return undefined;
    const wrapper = sectionNode(selectedId);
    const imgEl = wrapper?.querySelector<HTMLElement>(
      INLINE_IMAGE_FIELDS[type].selector
    );
    if (!imgEl) return selFrame; // fall back to the section frame
    const rect = imgEl.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    };
  })();

  const theme = doc.theme as ThemeTokens | undefined;

  // ── Guided tour steps (PR-2d) ───────────────────────────────────────────────
  // Targets are resolved against the live DOM at runtime; missing targets fall
  // back to a centered popover (EditorTour handles that).
  const tourSteps: TourStep[] = [
    { title: tips.tour.welcomeTitle, body: tips.tour.welcomeBody },
    {
      title: tips.tour.selectTitle,
      body: tips.tour.selectBody,
      target: "[data-st-section-id]",
    },
    { title: tips.tour.inlineTitle, body: tips.tour.inlineBody },
    {
      title: tips.tour.toolbarTitle,
      body: tips.tour.toolbarBody,
      target: '[data-tour="add-section"]',
    },
    {
      title: tips.tour.stylesTitle,
      body: tips.tour.stylesBody,
      target: '[data-tour="styles"]',
    },
    {
      title: tips.tour.saveTitle,
      body: tips.tour.saveBody,
      target: '[data-tour="publish"]',
    },
  ];

  // Empty-section hint: a SELECTED content-editable section whose settings are
  // empty (best-effort) gets a small "click Edit to add content" note.
  const selectedIsEmpty: boolean = (() => {
    if (!selectedId || !selectedType) return false;
    if (!isContentEditableSectionType(selectedType)) return false;
    const settings = doc.sections[selectedId]?.settings;
    if (!settings) return true;
    return Object.values(settings).every((v) => {
      if (v == null) return true;
      if (typeof v === "string") return v.trim() === "";
      if (Array.isArray(v)) return v.length === 0;
      return false;
    });
  })();

  return (
    <>
      {/* ── Fixed top bar ── */}
      <header className="st-editor-topbar" data-st-editor-chrome>
        <EditorTooltip label={tips.tooltipBack} side="bottom">
          <Link href="/dashboard/website" className="secondary-btn">
            &larr; {m.backToDashboard}
          </Link>
        </EditorTooltip>
        <span className="st-editor-title">{m.title}</span>

        <EditorTooltip label={tips.tooltipStyles} side="bottom">
          <button
            type="button"
            className="secondary-btn"
            data-tour="styles"
            onClick={() => {
              setStylesOpen((v) => !v);
              setEditingId(null);
            }}
          >
            {m.styles}
          </button>
        </EditorTooltip>

        <div className="st-editor-addmenu-wrap">
          <EditorTooltip label={tips.tooltipAddSection} side="bottom">
            <button
              type="button"
              className="secondary-btn"
              data-tour="add-section"
              disabled={atSectionLimit}
              onClick={() => setAddMenuOpen((v) => !v)}
            >
              + {m.addSection}
            </button>
          </EditorTooltip>
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

        {uploadingImage && (
          <span className="st-editor-badge">{m.uploadingImage}</span>
        )}
        {!uploadingImage && imageUploadError && (
          <span className="st-editor-badge is-error">{imageUploadError}</span>
        )}
        {!uploadingImage && !imageUploadError && autoSaving && (
          <span className="st-editor-badge">{m.savingDraft}</span>
        )}
        {!uploadingImage && !imageUploadError && !autoSaving && status.message && (
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
          <EditorTooltip label={tips.tooltipSaveDraft} side="bottom">
            <button type="submit" className="secondary-btn" disabled={draftPending}>
              {draftPending ? m.savingDraft : m.saveDraft}
            </button>
          </EditorTooltip>
        </form>
        <form action={publishAction}>
          <input type="hidden" name="document_json" value={documentJson} />
          <EditorTooltip label={tips.tooltipPublish} side="bottom">
            <button
              type="submit"
              className="primary-btn"
              data-tour="publish"
              disabled={publishPending}
            >
              {publishPending ? m.publishing : m.publish}
            </button>
          </EditorTooltip>
        </form>

        {/* ── Help launcher (?) ── */}
        <div className="st-editor-help-wrap" ref={helpMenuRef}>
          <EditorTooltip label={tips.tooltipHelp} side="bottom">
            <button
              type="button"
              className="st-editor-help-btn"
              aria-label={tips.tooltipHelp}
              aria-haspopup="menu"
              aria-expanded={helpOpen}
              onClick={() => setHelpOpen((v) => !v)}
            >
              <IconHelp />
            </button>
          </EditorTooltip>
          {helpOpen && (
            <div className="st-editor-help-menu" role="menu">
              <p className="st-editor-help-title">{tips.helpTitle}</p>
              <button
                type="button"
                role="menuitem"
                className="st-editor-help-replay"
                onClick={() => {
                  setHelpOpen(false);
                  setTourOpen(true);
                }}
              >
                {tips.helpReplayTour}
              </button>
              <p className="st-editor-help-tips-title">{tips.helpTipsTitle}</p>
              <ul className="st-editor-help-tips">
                <li>{tips.helpTip1}</li>
                <li>{tips.helpTip2}</li>
                <li>{tips.helpTip3}</li>
                <li>{tips.helpTip4}</li>
                <li>{tips.helpTip5}</li>
              </ul>
            </div>
          )}
        </div>
      </header>

      {/* ── Hover frame (hidden while a drawer is open or over the selection) ── */}
      {hoverFrame && hoverId !== selectedId && !editingId && !stylesOpen && !inlineEditing && (
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
            <EditorTooltip label={m.moveUp} side="top">
              <button
                type="button"
                aria-label={m.moveUp}
                disabled={selectedPinned || selectedIdx <= 0}
                onClick={() => onMove(selectedId, -1)}
              >
                <IconArrowUp />
              </button>
            </EditorTooltip>
            <EditorTooltip label={m.moveDown} side="top">
              <button
                type="button"
                aria-label={m.moveDown}
                disabled={selectedPinned || selectedIdx >= doc.order.length - 1}
                onClick={() => onMove(selectedId, 1)}
              >
                <IconArrowDown />
              </button>
            </EditorTooltip>
            <EditorTooltip label={selectedDisabled ? m.show : m.hide} side="top">
              <button
                type="button"
                aria-label={selectedDisabled ? m.show : m.hide}
                aria-pressed={!selectedDisabled}
                disabled={selectedPinned}
                onClick={() => onToggle(selectedId)}
              >
                {selectedDisabled ? <IconEyeOff /> : <IconEye />}
              </button>
            </EditorTooltip>
            {!selectedPinned && (
              <EditorTooltip label={m.removeSection} side="top">
                <button
                  type="button"
                  aria-label={m.removeSection}
                  onClick={() => onRemove(selectedId)}
                >
                  <IconTrash />
                </button>
              </EditorTooltip>
            )}
            <span className="st-editor-toolbar-sep" />
            <EditorTooltip label={m.editContentTitle} side="top">
              <button
                type="button"
                className="st-editor-toolbar-edit"
                onClick={() => openEditor(selectedId)}
              >
                <IconPencil /> {m.editContent}
              </button>
            </EditorTooltip>
          </div>

          {/* ── Empty-section hint (PR-2d) ── */}
          {selectedIsEmpty && (
            <div
              className="st-editor-empty-hint"
              data-st-editor-chrome
              role="note"
              style={{
                top: selFrame.top + selFrame.height / 2 - 14,
                left: selFrame.left + selFrame.width / 2,
              }}
            >
              {tips.emptySectionHint}
            </div>
          )}

          {/* ── On-canvas "Replace image" overlay (PR-2b) ── */}
          {selectedImageFrame && selectedType && INLINE_IMAGE_FIELDS[selectedType] && (
            <div
              className="st-editor-replace-image-wrap"
              data-st-editor-chrome
              style={{
                top: selectedImageFrame.top + 8,
                left: selectedImageFrame.left + 8,
              }}
            >
              <EditorTooltip label={m.replaceImage} side="bottom">
                <button
                  type="button"
                  className="st-editor-replace-image"
                  aria-label={m.replaceImage}
                  disabled={uploadingImage}
                  onClick={() => onReplaceImageClick(selectedId)}
                >
                  {uploadingImage ? (
                    `… ${m.uploadingImage}`
                  ) : (
                    <>
                      <IconImage /> {m.replaceImage}
                    </>
                  )}
                </button>
              </EditorTooltip>
            </div>
          )}
        </>
      )}

      {/* Hidden file input shared by all section image-replace buttons. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        data-st-editor-chrome
        style={{ display: "none" }}
        onChange={(e) => {
          void onImageFilePicked(e);
        }}
      />

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

      {/* ── Canvas hint bar (PR-2d): shown until first inline edit or dismissal ── */}
      {!inlineHintDismissed && !hasInlineEdited && (
        <div className="st-editor-hintbar" data-st-editor-chrome role="note">
          <span className="st-editor-hintbar-text">{tips.inlineHintText}</span>
          <button
            type="button"
            className="st-editor-hintbar-close"
            aria-label={tips.inlineHintDismiss}
            onClick={dismissInlineHint}
          >
            <IconClose size={14} />
          </button>
        </div>
      )}

      {/* ── First-run / replayable guided tour (PR-2d) ── */}
      <EditorTour
        open={tourOpen}
        steps={tourSteps}
        labels={tips.tour}
        onClose={() => setTourOpen(false)}
      />
    </>
  );
}
