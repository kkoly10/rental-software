// Relative `.ts` imports (not the @/ alias) so this module stays unit-testable
// under `node --test --experimental-strip-types`, which doesn't resolve the
// tsconfig path alias (project convention — see page-document-schema.ts).
import {
  storefrontPageDocumentSchema,
  type SectionRecord,
  type StorefrontPageDocument,
  type SynthesizedSection,
} from "./page-document-schema.ts";
import {
  SECTION_REGISTRY,
  isKnownSectionType,
  type SectionType,
} from "./sections/registry.ts";
import {
  SECTION_CONTENT_SCHEMAS,
  isContentEditableSectionType,
} from "./sections/content-schemas.ts";
import {
  themeTokensSchema,
  type ThemeTokens,
} from "../data/storefront-tokens-schema.ts";

/**
 * PURE builder-document helpers (no DB / server deps) backing the visible
 * section builder (PR-1b, spec §2/§10). They keep the builder UI and the
 * save/publish action working off ONE document shape and ONE set of
 * constraints, and stay testable under `node --test`.
 *
 * Scope of PR-1b: reorder + show/hide of the EXISTING section set only. No
 * add/remove of section TYPES (that's a later PR), so these helpers never
 * mutate the membership of `order` — only its sequence and per-section
 * `disabled` flags.
 */

export const SCHEMA_VERSION = 1;

/**
 * Build a fresh page document from the synthesized default sections (§7) plus
 * the resolved theme tokens. Used to seed the builder the first time an org
 * opens it (no persisted document yet). NOT auto-persisted — only Save/Publish
 * writes.
 */
export function buildDocumentFromSynthesized(
  sections: SynthesizedSection[],
  theme: ThemeTokens
): StorefrontPageDocument {
  const order: string[] = [];
  const sectionMap: Record<string, SectionRecord> = {};
  for (const s of sections) {
    order.push(s.id);
    sectionMap[s.id] = { type: s.type, disabled: s.disabled };
  }
  return { schemaVersion: SCHEMA_VERSION, order, sections: sectionMap, theme };
}

/**
 * A persisted document may predate the current theme editor, carry a stale/
 * partial theme, or (defensively) be malformed. Normalize an existing document
 * into a clean builder-ready document: keep its order/sections but re-attach the
 * resolved theme tokens so the Styles tab always edits a valid theme.
 */
export function normalizeExistingDocument(
  doc: StorefrontPageDocument,
  theme: ThemeTokens
): StorefrontPageDocument {
  return {
    schemaVersion: doc.schemaVersion || SCHEMA_VERSION,
    order: [...doc.order],
    sections: { ...doc.sections },
    theme,
  };
}

/** Whether a section id resolves to an `alwaysPresent` registry type. */
export function isAlwaysPresentSection(
  doc: StorefrontPageDocument,
  id: string
): boolean {
  const type = doc.sections[id]?.type;
  if (!type || !isKnownSectionType(type)) return false;
  return SECTION_REGISTRY[type as SectionType].alwaysPresent === true;
}

/**
 * Move a section one step up (dir = -1) or down (dir = +1) in `order`.
 *
 * Constraint (spec §10): `alwaysPresent` sections (hero, closing) are pinned to
 * the ends — they can't move, and a non-fixed section can't cross past them.
 * Returns a NEW order (or the same reference when the move is a no-op so callers
 * can skip a state update).
 */
export function moveSection(
  doc: StorefrontPageDocument,
  id: string,
  dir: -1 | 1
): string[] {
  const order = doc.order;
  const idx = order.indexOf(id);
  if (idx === -1) return order;

  // Pinned sections never move.
  if (isAlwaysPresentSection(doc, id)) return order;

  const target = idx + dir;
  if (target < 0 || target >= order.length) return order;

  // Don't let a movable section swap past a pinned end section.
  if (isAlwaysPresentSection(doc, order[target])) return order;

  const next = [...order];
  [next[idx], next[target]] = [next[target], next[idx]];
  return next;
}

/**
 * Toggle a section's `disabled` flag. `alwaysPresent` sections can't be hidden
 * (spec §10) — toggling one is a no-op that returns the document unchanged.
 */
export function toggleSectionDisabled(
  doc: StorefrontPageDocument,
  id: string
): StorefrontPageDocument {
  if (!doc.sections[id]) return doc;
  if (isAlwaysPresentSection(doc, id)) return doc;

  const current = doc.sections[id];
  return {
    ...doc,
    sections: {
      ...doc.sections,
      [id]: { ...current, disabled: !current.disabled },
    },
  };
}

/** Replace the theme tokens on a document (Styles tab). */
export function setDocumentTheme(
  doc: StorefrontPageDocument,
  theme: ThemeTokens
): StorefrontPageDocument {
  return { ...doc, theme };
}

/**
 * Patch one field of a section's `settings` (Sections tab content editor,
 * PR-1c). Immutably updates `sections[id].settings[key]`. A `value` of
 * undefined or "" REMOVES the key so the field falls back to the component's
 * default (byte-for-byte safety — an empty editor field = "use the default",
 * not "store an empty string"). No-op (same reference) when the id is unknown.
 */
export function setSectionSetting(
  doc: StorefrontPageDocument,
  id: string,
  key: string,
  value: string | undefined
): StorefrontPageDocument {
  const record = doc.sections[id];
  if (!record) return doc;

  const nextSettings: Record<string, unknown> = { ...(record.settings ?? {}) };
  if (value === undefined || value === "") {
    delete nextSettings[key];
  } else {
    nextSettings[key] = value;
  }

  return {
    ...doc,
    sections: {
      ...doc.sections,
      [id]: { ...record, settings: nextSettings },
    },
  };
}

/**
 * Patch a section's `settings` with a NON-string value (Sections tab content
 * editor, PR-1d). Used for the array-valued content sections (trust badges,
 * testimonials, faq items). Immutably updates `sections[id].settings[key]`. An
 * `undefined` value (or an empty array) REMOVES the key so the field falls back
 * to the component's default (byte-for-byte safety — an empty editor list =
 * "use the default", not "store an empty array"). No-op (same reference) when
 * the id is unknown.
 */
export function setSectionSettingValue(
  doc: StorefrontPageDocument,
  id: string,
  key: string,
  value: unknown
): StorefrontPageDocument {
  const record = doc.sections[id];
  if (!record) return doc;

  const nextSettings: Record<string, unknown> = { ...(record.settings ?? {}) };
  if (value === undefined || (Array.isArray(value) && value.length === 0)) {
    delete nextSettings[key];
  } else {
    nextSettings[key] = value;
  }

  return {
    ...doc,
    sections: {
      ...doc.sections,
      [id]: { ...record, settings: nextSettings },
    },
  };
}

export type ParsedBuilderDocument = {
  document: StorefrontPageDocument;
  theme: ThemeTokens;
};

/**
 * Validate a serialized builder document for the save/publish actions: the whole
 * document against storefrontPageDocumentSchema AND its embedded `theme` against
 * themeTokensSchema. Returns the parsed document with the theme normalized back
 * onto it so the action persists ONE coherent object (no theme-only vs
 * sections-only write paths that could clobber each other — spec §4).
 *
 * Also enforces that every section type in `order`/`sections` is a known,
 * renderable type (unknown types would render a fallback on the live site).
 */
export function parseBuilderDocument(
  raw: unknown
):
  | { ok: true; value: ParsedBuilderDocument }
  | { ok: false; message: string } {
  const parsedDoc = storefrontPageDocumentSchema.safeParse(raw);
  if (!parsedDoc.success) {
    return {
      ok: false,
      message:
        parsedDoc.error.issues[0]?.message ?? "Storefront layout is invalid.",
    };
  }
  const doc = parsedDoc.data;

  if (doc.order.length === 0) {
    return { ok: false, message: "Storefront layout has no sections." };
  }

  // order ↔ sections must be consistent, and every type must be renderable.
  // For content-editable types (hero/about), validate + NORMALIZE the per-section
  // `settings` against its content schema so bounded lengths are enforced on the
  // publish path (spec §2) and only the known fields are persisted.
  const normalizedSections: Record<string, SectionRecord> = {};
  for (const id of doc.order) {
    const record = doc.sections[id];
    if (!record) {
      return { ok: false, message: "Storefront layout references a missing section." };
    }
    if (!isKnownSectionType(record.type)) {
      return { ok: false, message: `Unknown section type: ${record.type}.` };
    }

    if (record.settings !== undefined && isContentEditableSectionType(record.type)) {
      const schema = SECTION_CONTENT_SCHEMAS[record.type];
      const parsedSettings = schema.safeParse(record.settings);
      if (!parsedSettings.success) {
        return {
          ok: false,
          message:
            parsedSettings.error.issues[0]?.message ??
            `Content for the ${record.type} section is invalid.`,
        };
      }
      normalizedSections[id] = { ...record, settings: parsedSettings.data };
    } else {
      normalizedSections[id] = record;
    }
  }

  const parsedTheme = themeTokensSchema.safeParse(doc.theme);
  if (!parsedTheme.success) {
    return {
      ok: false,
      message:
        parsedTheme.error.issues[0]?.message ??
        "Theme settings are out of range.",
    };
  }

  return {
    ok: true,
    value: {
      document: { ...doc, sections: normalizedSections, theme: parsedTheme.data },
      theme: parsedTheme.data,
    },
  };
}
