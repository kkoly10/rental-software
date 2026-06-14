# Storefront Editorial Builder — Implementation Spec

**Created:** 2026-06-14 · **Owner:** founder + Claude · **Status:** scope + entry-point RATIFIED (§9–§10); G2 build next

The concrete, build-ready design for turning the tenant storefront into an
operator-editable **editorial builder** (the G2/G3/G4 vision in
`storefront-builder-plan.md`). Grounded in a research pass over how the
leaders architect this — Shopify Online Store 2.0, Puck, Builder.io, the
W3C Design Tokens format, and Next.js Draft Mode — and mapped onto our
actual stack (Next.js 16 RSC + Supabase/Postgres-JSON + the `party-classic`
theme).

> Guiding principle from the research: **gate the escape hatches, not the
> editor.** Give everyone constrained, layout-safe editing (bounded ranges,
> curated palettes/fonts, presets). Paywall raw power (custom CSS,
> branding removal, custom fonts). Never let an operator break their own
> layout or assert claims/styles that fail accessibility.

---

## 1. What exists today (build on this, don't replace)

- **Content in `organizations.settings` JSON**, read via `getContentSettings`
  (`lib/data/content-settings.ts`) / written via `lib/settings/content-actions.ts`:
  hero text/image, trust badges, testimonials, about, FAQ, nav links, and
  **`section_visibility`** (show/hide per section).
- **Brand injection** (`components/layout/brand-style-injector.tsx`):
  `--primary`/`--accent` + one of 7 Google fonts → CSS vars, scoped so it
  never leaks into the dashboard. (This is the seed of the token system.)
- **Theme settings** (`lib/data/theme-settings.ts`): `themeId`
  (only `party-classic`), CTA/visibility toggles.
- **Section components** in `components/public/themes/party-classic/*`
  (hero, trust-strip, category-tiles, browse-tiles, how-it-works,
  service-area, reviews-cards, about, faq, closing) — each already a
  self-contained RSC reading settings + vertical defaults.
- **Tier gating** (`lib/stripe/gate.ts` `checkFeatureAccess`) across
  Starter/Pro/Growth.

The builder is the natural evolution of this: promote the fixed section
LIST + the partial token set into first-class, editable, ordered data.

---

## 2. Section data model (Shopify OS 2.0 shape)

Use a **keyed map + order array**, not an ordered array of objects — so a
per-section edit targets a stable key, reordering is a cheap array swap
that never touches section bodies, and concurrent edits don't collide.

```jsonc
// the page document (per tenant, per page)
{
  "schemaVersion": 1,
  "order": ["sec_hero1", "sec_trust1", "sec_how1", "sec_catalog1"],
  "sections": {
    "sec_hero1": {
      "type": "hero",
      "disabled": false,
      "settings": { "headlineLead": "...", "headlineItalic": "...", "imageRef": "..." },
      "blocks": { "blk_cta1": { "type": "cta", "settings": { "label": "Book now", "href": "/inventory" } } },
      "blockOrder": ["blk_cta1"]
    }
  }
}
```

- **`type`** maps to a component in a **code-side registry** (the source of
  truth for *what's editable*); the DB only stores instance data.
- **`disabled`** soft-hides (keeps it editable) — replaces today's
  `section_visibility` booleans.
- **Opaque generated IDs** (`sec_*`, `blk_*`), never array indices.
- **Limits** enforced on save (e.g. ≤20 sections/page, ≤20 blocks/section).

### Section registry (in code, Zod)
```ts
// lib/storefront/sections/registry.ts (new)
type SectionDef = {
  type: string;                 // "hero" | "trust" | "how-it-works" | "browse" | "custom-rich" | ...
  label: string;                // editor picker label
  settingsSchema: ZodSchema;    // validates + fills defaults
  blocks?: BlockDef[];          // nested editable items (e.g. CTA, step, tile)
  presets?: SectionPreset[];    // shown in "Add section"; no preset = can't be added/removed
  render: (settings, ctx) => ReactNode;  // RSC renderer
  tier?: "starter" | "pro" | "growth";   // min tier to ADD this section type
  maxPerPage?: number;
};
```
Day-one section types = the existing party-classic sections re-expressed as
registry entries (hero, trust, category grid, browse-by-occasion,
how-it-works, featured, service-area, testimonials, about, FAQ, closing) +
a new **`custom-rich`** (heading + rich text + optional image) and
**`custom-gallery`** block for the builder's "add a section" story.

### Storage
New table, NOT more `organizations.settings` bloat:
```sql
create table storefront_pages (
  organization_id uuid not null references organizations(id) on delete cascade,
  page_key   text not null default 'home',     -- room for /about, landing pages later
  draft      jsonb not null default '{}'::jsonb,
  published  jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id, page_key)
);
-- RLS: members read; owners/admins write (mirror document_templates).
-- Public storefront reads `published` via admin client (anon path).
```
Keep a small `storefront_page_versions` history table (jsonb snapshots) for
rollback.

---

## 3. Theme tokens (constrained → CSS variables)

Store a **fixed, bounded token set** (W3C-token-shaped) and emit it as CSS
custom properties at RSC render (extend `brand-style-injector`). The whole
point: operators tune within rails, they can't break layout or contrast.

Token groups (all with sane min/max/step or curated options):
- **Color scheme** (PAIRED, not loose): `background` (the "cream"),
  `surface`, `text`, `text-muted`, `primary`, `accent`. Stored as a scheme
  so foreground/background are validated together. Offer **presets** +
  a custom scheme (Pro), with **WCAG contrast validated on save** (the
  helper already exists, `lib/utils/contrast.ts`) — reject/repair < 4.5:1.
- **Typography**: heading font + body font from a **curated allowlist**
  (self-hosted via `next/font`), a bounded **type scale** (e.g. base
  15–18px, scale ratio select), heading weight from a set.
- **Spacing/radius**: bounded `range` tokens (section padding, corner
  radius) → `--st-section-pad-y`, `--st-radius-*` (also fixes today's
  undefined `--st-radius-pill`).

No free-form CSS in the token layer. Presets pass accessibility by
construction; custom values are validated server-side on save.

---

## 4. Live preview (Next.js Draft Mode + iframe)

Industry pattern (Shopify, Builder.io): **side-panel editor + the real
site in an iframe, driven by postMessage**. The RSC-native mechanism is
**Next.js Draft Mode**.

- **`/dashboard/website/builder`** = the editor: left = live preview
  iframe, right = section list (reorder/add/remove) + selected-section
  settings form. Mobile preview = a **width toggle** on the iframe
  container (375px), not a separate render path.
- The iframe loads **`/preview/[page]`**, a route that calls
  `draftMode().enable()` (secret-protected route handler) and renders from
  the **`draft`** column instead of `published`. Draft Mode forces dynamic
  render and bypasses caching, so drafts are always fresh.
- **Live updates:** start simple — editor debounce-saves the draft →
  `iframe.contentWindow` `router.refresh()`. Add `postMessage` section-level
  patching later as an optimization (don't build it first).
- **Publish** = copy `draft` → `published`, set `published_at`, snapshot a
  version row. The public storefront only ever reads `published`.

---

## 5. Tier-gating (enforced in two layers)

Per the research: UI hides/disables gated controls **and** the save Server
Action rejects gated fields — never trust the client. Plan read from the
org/subscription (`getSubscriptionInfo`), checked in the action that
persists section/theme JSON.

| Capability | Tier |
|---|---|
| Edit existing sections' content + images; show/hide sections; brand color + curated font; section *reorder* | **All / Starter** |
| Full theme tokens (cream/bg, type scale, radius); add/remove sections incl. `custom-rich`/`custom-gallery`; extra fonts | **Pro** |
| Custom CSS (if ever), white-label, multiple theme presets, custom domains-level polish | **Growth** |

(Branding removal already done globally — the CrecyStudio credit is gone.)

---

## 6. Safety, versioning, migration (the hard parts)

- **Draft vs published** columns (above) — never edit live.
- **`schemaVersion` + forward migrations.** Stored JSON will drift from
  code. Validate every read with Zod, fill defaults for new settings, and
  write idempotent `vN→vN+1` migrators (run on read or as a batch). (Puck
  is literally mid-migration from `zones`→`slots` — assume this happens.)
- **Unknown/removed section or block types** → render a **fallback
  placeholder**, never crash; keep the data. Soft-delete via `disabled`
  before hard removal.
- **No raw HTML/CSS at first.** Prefer exposing more tokens over an
  escape hatch. If custom CSS is later added (Growth): whitelist-sanitize
  (DOMPurify), **scope to the tenant subtree**, strip `@import`/`url()`/
  `expression`/`behavior`, and ship a strict CSP — CSS at-rules can smuggle
  script (OWASP/sanitize advisories).
- **Image uploads** reuse the existing brand/upload bucket + sniffing
  (`lib/settings/brand-upload-actions.ts` pattern).

---

## 7. Migration from today's settings (no operator disruption)

On first load of the builder for an org with no `storefront_pages` row:
**synthesize a default page document** from their current state — map
`section_visibility` → `order`/`disabled`, and existing
`settings`/`content` (hero, trust badges, testimonials, about, faq) into
the corresponding section `settings`. Publish it immediately so the live
site is byte-for-byte what it is today, then let them edit. The legacy
`getContentSettings` readers keep working until every section is migrated
to read from the page document (incremental cutover, section by section).

---

## 8. Phased build (maps to the roadmap)

- **G1 (separate, ship first — no builder needed):** delete the duplicate
  `.st-section-head` CSS (de-island), make How-it-works + browse-by-occasion
  editable *with today's content_settings* (cheap interim), sticky header +
  real desktop Book button, empty states, the cross-cutting P0s. This buys
  the visible win while the builder is designed.
- **G2 — token system:** `storefront_pages` table (theme half) + the
  constrained token editor + RSC CSS-var emit + contrast validation + the
  curated `next/font` set. Live preview via Draft Mode.
- **G3 — section builder:** the section registry + keyed-map document +
  reorder/add/remove UI + `custom-rich`/`custom-gallery` + the migration
  synthesizer (§7) + publish/versioning.
- **G4 — power/white-label:** custom CSS (sanitized+scoped, Growth),
  multiple presets, galleries/lightbox.

---

## 9. Decisions — RATIFIED 2026-06-14 (was: open)
Grounded in a competitor pass (Booqable = the direct rental-builder benchmark;
Shopify/Squarespace/Wix = the general bar). Decisions:

- **Typography:** curated, self-hosted fonts + a **bounded** size/type-scale
  control (base-size range + scale-ratio), heading weight from a set. Operators
  *can* change size (Booqable does), but within rails — no free pixel input.
- **Layout/sections:** edit + show/hide + **reorder** existing sections (all
  tiers); **add/remove** curated section types incl. `custom-rich` + a
  `custom-gallery` (Pro). Matches Booqable's block-rearrange builder.
- **Images:** swap images in existing sections (all tiers); add image/gallery
  sections (Pro). Reuse the sniffed upload bucket.
- **Color/shape:** full paired color scheme (incl. the "cream" background) +
  radius tokens, **contrast-validated on save**; presets for all, custom on Pro.
- **Custom CSS:** **NONE in v1** (tokens-only). If ever added, it's **bounded +
  Growth-gated + sanitized/scoped** — never unlimited (Shopify caps at
  500/1500 chars; SQSP/Wix paywall it; unrestricted CSS = support/breakage
  burden). Default stance: stay tokens-only unless real demand appears.
- **Page scope:** **home page first.** Schema keeps `page_key`, so About /
  landing pages are a fast follow, not a rebuild.
- **Tier split (ratified):** content + brand color/font + reorder = entry;
  full theme tokens + add/remove sections + extra fonts = **Pro**;
  white-label + any future custom CSS = **Growth**.

Net: this puts Korent at parity with Booqable (the best rental builder) and
ahead of the party-rental-specific tools (InflatableOffice/Goodshuffle).

## 10. Entry point & editor UX (ratified 2026-06-14)
- **Progressive disclosure.** The existing `/dashboard/website` quick-edit
  settings stay for the satisfied majority. A prominent **"Design your
  storefront"** CTA at the TOP opens the full builder. (Operator-facing label,
  not "editorial".)
- **Dedicated full-screen builder route** `/dashboard/website/builder` — NOT
  edit-in-place on the live public storefront. Left = the real storefront in a
  **live-preview iframe** (Next.js Draft Mode → `draft` doc); right = section
  list (reorder/add/remove) + selected-section settings. Feels like "editing my
  storefront page," but no editor JS ever runs on the public anon site.
- **Gate on click, not on visibility.** Everyone sees the CTA; entry tiers get
  the upsell ("Storefront design is on Pro").
- **Single source of truth per field.** Quick form writes
  `organizations.settings`; the builder writes `storefront_pages` draft/
  published. On first builder entry the page doc is synthesized from current
  settings (§7); thereafter a section that lives in the builder is removed from
  / read-only in the quick form so the two never diverge.
