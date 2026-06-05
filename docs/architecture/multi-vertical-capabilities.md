# Multi-vertical capabilities architecture

**Status:** Active build plan
**Date:** June 2026
**Owner:** Product + engineering
**Supersedes for new work:** `docs/strategy/05-vertical-roadmap.md` (the "vehicles & fleet as #2" decision)

---

## TL;DR

Korent is expanding from one mature vertical (inflatables) to **five party-rental verticals** in three phases:

1. **Tents & canopies**
2. **Tables & chairs**
3. **Dance floors & staging**
4. **Photo booths**
5. **Concessions** (popcorn, snow cone, cotton candy)

To do this without copy-pasting inflatable-shaped code into 5 sibling modules, we are adopting a **capability-based architecture**: small composable behaviors (pricing models, setup logistics, display helpers) that verticals declare as a list. Verticals become thin configurations that pick from the capability buffet.

The current code's inflatable-specific surface (wet/dry, anchoring) is already capability-shaped — it just lives in scattered files. Phase 0 extracts it into the capability pattern with zero behavior change. Phase 1+ adds the new capabilities that unlock photo booths and concessions. Phase 2 ships marketing pages and configs for the 5 verticals.

**Parked for later (Tier C+):** linens, bar equipment, games & amusements, generators, restrooms, wedding decor. These are valid verticals; we're sequencing them after the first five ship.

---

## 1. Why capabilities, not modules-per-vertical

The naive structure ("one folder per vertical, each with its own pricing/forms/pull-sheet code") fails because:

- **~80% of vertical logic is shared.** A tent operator's product form, checkout, deposit handling, and delivery routing look very similar to an inflatable operator's. Duplicating the code creates 5+ parallel copies that will drift.
- **Cross-vertical operators are the norm.** An inflatable shop almost always also rents tents, tables, and concessions. A "which folder does this org belong to?" model has no clean answer.
- **The high-leverage feature unlocks are cross-cutting.** Per-hour pricing unlocks 4+ verticals in one capability; multi-day-tiered pricing unlocks 3+. Modules-per-vertical implements each pricing model N times.

The capability pattern matches what mature vertical SaaS (Shopify channels, Stripe payment methods, Salesforce features) converges on.

---

## 2. Domain model

### 2.1 Capability

A **Capability** is a small, composable piece of domain behavior. Each capability owns:

- **Schema additions** — columns, capability tables, or JSONB shape it requires
- **Validation** — Zod schemas for input
- **Form fields** — React components rendered inside the product/order forms
- **Business logic** — pricing, formatting, scheduling helpers
- **i18n keys** — labels and copy under a namespaced i18n block

Capabilities live under `lib/capabilities/<group>/<name>.ts`:

```
lib/capabilities/
  pricing/
    flat-day.ts            ← existing default behavior
    per-hour.ts            ← NEW (Phase 1)
    per-unit.ts            ← NEW (Phase 1)
  setup/
    anchoring.ts           ← extracted from current inflatable code
    surface-type.ts        ← extracted
    setup-window.ts        ← NEW (Phase 1)
    capacity-calculator.ts ← NEW (Phase 1)
  mode/
    wet-dry.ts             ← extracted
  display/
    structured-specs.ts    ← NEW (Phase 1)
  service/
    onsite-attendant.ts    ← NEW (Phase 1)
  order/
    minimum-order.ts       ← NEW (Phase 1)
```

Each capability file exports a typed `Capability` object:

```ts
export const perHourPricing: Capability<PerHourConfig> = {
  slug: "pricing.per-hour",
  group: "pricing",
  schemaColumns: {  // optional: products table columns this capability adds
    hourly_rate_cents: "integer",
    minimum_hours: "integer",
    idle_hour_rate_cents: "integer | null",
  },
  validate: zodSchema,
  productFormFields: PerHourPricingFields,
  computeLineTotal: (item, ctx) => { /* ... */ },
  formatPullSheet: (item) => { /* ... */ },
  i18nKey: "capabilities.pricing.perHour",
};
```

### 2.2 Vertical

A **Vertical** is a thin configuration that declares which capabilities it uses, plus labels, default category seeds, and marketing content:

```ts
// lib/verticals/photo-booths.ts
export const photoBoothsVertical: VerticalConfig = {
  slug: "photo-booths",
  label: { en: "Photo booths", es: "Photo booths", fr: "Photobooths", pt: "Photo booths" },
  capabilities: [
    "pricing.per-hour",
    "setup.setup-window",
    "service.onsite-attendant",
    "display.structured-specs",
  ],
  defaultCategorySeeds: [
    "Open-air booths",
    "Enclosed booths",
    "360° booths",
    "Mirror booths",
  ],
  marketing: {
    heroHeadline: "...",
    industryFitFeatures: ["per-hour pricing", "idle-hour rate", "..."],
    sampleProductName: "Open-Air Photo Booth · 3 hours",
    landingPageSlug: "photo-booth-rental-software",
  },
  imageSlugs: {
    hero: "photo-booths/hero.jpg",
    crew: "photo-booths/crew.jpg",
    inventory: "photo-booths/inventory.jpg",
  },
};
```

Adding a future vertical = creating one TS file + sourcing 3 images. No new pricing engine, no new pull-sheet formatter, no copy-paste.

### 2.3 OrganizationVerticals (multi-vertical orgs)

Most real operators are multi-vertical (an inflatable shop usually also rents tents/tables/concessions). The current single `organizations.business_type` column does not model this.

Migration adds a join table:

```sql
create table organization_verticals (
  organization_id uuid not null references organizations(id) on delete cascade,
  vertical_slug   text not null,
  is_primary      boolean not null default false,
  added_at        timestamptz not null default now(),
  primary key (organization_id, vertical_slug)
);

create unique index organization_verticals_one_primary
  on organization_verticals(organization_id) where is_primary;
```

`organizations.business_type` is kept (back-compat) and treated as the primary vertical for orgs that have one row in the join table. New signup writes both. Older code reading `business_type` continues to work during the migration window.

### 2.4 Product capabilities

A capability declared at the org level is the **buffet**. A product opts into specific capabilities from that buffet via:

```sql
alter table products add column capability_slugs text[] not null default '{}';
```

Example: an inflatable org renting both bounce houses and tents — a bounce house product has `["pricing.flat-day", "setup.anchoring", "setup.surface-type", "mode.wet-dry"]`, a tent product has `["pricing.flat-day", "setup.anchoring", "setup.surface-type", "setup.setup-window"]`. The product form renders form fields per capability; the storefront shows only the relevant filters.

Default: when a product is created under a category, the product inherits the category's default capabilities (categories themselves get a `default_capability_slugs` column).

---

## 3. The five verticals — capability sets

### 3.1 Tents & canopies

| Need | Capability |
|---|---|
| Flat-day pricing ($300/day) | `pricing.flat-day` *(existing)* |
| Stakes / sandbags / water barrels by surface | `setup.anchoring` *(extracted)* |
| Grass vs concrete vs asphalt | `setup.surface-type` *(extracted)* |
| Operator arrives 2–4 hours before event | `setup.setup-window` *(NEW)* |
| Display "fits 100 guests" / "20×20 = 400 sq ft" | `display.capacity-calculator` *(NEW)* |
| Dimensions, peak height, side wall count | `display.structured-specs` *(NEW)* |

**Out of scope for v1 (defer):**
- Component/kit composition (tents = parent + sidewalls + lighting as children). Workaround: list each size+config as a separate SKU. Revisit in Phase B.
- Site survey workflow. Workaround: operator handles via order notes.
- Permit tracking. Workaround: operator handles via document upload (already supported).

**Sources:**
- Tent Rental Systems pricing & feature page (component tracking, crew scheduling, weather-aware delivery)
- Booqable "How to start a party tent rental business" 2026 guide
- gitnux.org "Top 10 Tent Rental Software 2026"

### 3.2 Tables & chairs

| Need | Capability |
|---|---|
| Per-unit pricing ($5–7/chair × qty) | `pricing.per-unit` *(NEW)* |
| Order minimum ($600 typical) | `order.minimum-order` *(NEW)* |
| Style / color filter on storefront (chiavari gold/silver/clear, banquet round/rectangular) | `display.structured-specs` *(NEW)* |
| Delivery + next-day pickup included | `pricing.flat-day` *(existing)* |

**Out of scope for v1 (defer):**
- Optional setup-service surcharge ("we'll arrange the chairs for $1/chair"). Workaround: list as separate product or include in price. Revisit when add-on capability lands (Phase B).

**Sources:**
- chiavarichairrentals.org pricing ($4.95/chair nationwide, $600 minimum)
- Current Event Rentals 2026 pricing guide

### 3.3 Dance floors & staging

| Need | Capability |
|---|---|
| Sized in 3'×3' sections (12×12, 16×16, 24×24) | Multiple SKUs per size *(simple path)* |
| Per-unit pricing per section OR flat per size | `pricing.per-unit` *(NEW)* + `pricing.flat-day` *(existing)* |
| Assembly window (1–2 hours setup, 1 hour teardown) | `setup.setup-window` *(NEW)* |
| Guest count → recommended size on storefront | `display.capacity-calculator` *(NEW)* |
| Dimensions, panel count, surface type (parquet/black/white/LED) | `display.structured-specs` *(NEW)* |
| Crew assembly skill flag | order notes for v1 |

**Sources:**
- Imperial Party Rentals 2026 pricing guide ($225 for 12×12 / 30–40 dancers)
- Reventals dance floor size calculator (30–50% guest list rule)

### 3.4 Photo booths

| Need | Capability |
|---|---|
| **Per-hour pricing** with 2–3 hour minimum | `pricing.per-hour` *(NEW)* |
| Idle-hour rate (booth present but inactive — half rate) | `pricing.per-hour` *(NEW — config option)* |
| Operator arrives ~60 min before event | `setup.setup-window` *(NEW)* |
| Onsite attendant included (or surcharge) | `service.onsite-attendant` *(NEW)* |
| Backdrop catalog (visual picker) | `display.structured-specs` *(NEW — variant picker via attributes; full visual picker deferred)* |
| Equipment specs (booth size, power, footprint) | `display.structured-specs` *(NEW)* |

**Out of scope for v1 (defer to Phase B):**
- Multi-step booking flow (package → backdrop → template → addons). Current single-step checkout is fine for v1.
- Template overlay catalog. Operator can attach via order notes / asset link.
- Post-event gallery upload. Workaround: operator emails gallery link via existing communications module.
- Mini-session back-to-back slot booking. Workaround: operator manually splits.

**Sources:**
- Check Cherry photo-booth CRM feature list
- Snappic "7 Best Photo Booth Software 2026"
- Kande Photo Booths 2026 pricing guide (3-hour minimum baseline)
- Pixilated "Essential Guide to Photo Booth Rental Business 2026"

### 3.5 Concessions

| Need | Capability |
|---|---|
| **Per-hour pricing** with 1-hour minimum | `pricing.per-hour` *(NEW)* |
| Power requirements (110V / 20A standard) | `display.structured-specs` *(NEW — generic spec table for v1)* |
| Footprint / dimensions | `display.structured-specs` *(NEW)* |
| Consumables included (popcorn kernels, syrup) | `display.structured-specs` *(NEW)* |
| Servings per unit ("makes 40 snow cones per 20lb ice") | `display.structured-specs` *(NEW)* |
| Optional onsite attendant (1hr included, +$100/hr after) | `service.onsite-attendant` *(NEW)* |

**Out of scope for v1 (defer):**
- Cleaning fee add-on. Workaround: embed in base price or operator collects later.
- Consumables restocking flow. Workaround: each rental is fresh kit.

**Sources:**
- Freedom FUN USA Dallas concession rentals page (consumables included, 110V requirement)
- GigSalad concession-for-hire listings (attendant pricing models)
- M&B Concessions service-package examples

---

## 4. Capabilities to build (Phase 1 master list)

These are the new capabilities required to ship all five verticals at 10/10 fit:

| Capability | Used by | Implementation notes |
|---|---|---|
| `pricing.per-hour` | Photo booths, concessions | New `products.hourly_rate_cents`, `minimum_hours`, `idle_hour_rate_cents` columns. New checkout flow asking for start + end hour. |
| `pricing.per-unit` | Tables, chairs, dance floors (per-section variant) | New `products.unit_price_cents`, `unit_label` ("chair", "section"). Order line stores qty × unit price. |
| `setup.setup-window` | Tents, dance floors, photo booths | New `products.setup_minutes_before` integer. Crew pull sheet shows arrival = event start − setup_minutes. |
| `display.capacity-calculator` | Tents, dance floors | New `products.capacity_metric` enum (`guests`, `sq_ft`, `dancers`) + `capacity_value` integer. Storefront calculator widget. |
| `display.structured-specs` | All five (specs table on PDP) | New `product_specs` table — key/value pairs (`product_id`, `spec_key`, `spec_label`, `spec_value`, `display_order`). Storefront renders a definition list. Replaces ad-hoc `product_attributes` for visible specs. |
| `service.onsite-attendant` | Photo booths, concessions | New `products.attendant_included_hours` integer + `products.attendant_overage_cents_per_hour`. Order line auto-adds overage when rental exceeds. |
| `order.minimum-order` | Tables & chairs | New `products.minimum_order_quantity` integer OR `categories.minimum_order_cents`. Storefront blocks checkout below threshold. |

All seven capabilities are implementable in **~2–3 weeks** of focused work. Per-hour pricing is the highest-leverage single capability (unlocks 2 of the 5 verticals on its own) and should be built first inside Phase 1.

---

## 5. Schema migrations

All migrations follow the existing `supabase/migrations/<date>_<sequence>_<slug>.sql` convention and are non-breaking (additive columns, default values, NOT VALID + VALIDATE for constraints on populated tables).

### 5.1 Phase 0 — Foundation

```sql
-- migration: 20260606_010000_organization_verticals.sql
create table organization_verticals (
  organization_id uuid not null references organizations(id) on delete cascade,
  vertical_slug   text not null,
  is_primary      boolean not null default false,
  added_at        timestamptz not null default now(),
  primary key (organization_id, vertical_slug)
);

create unique index organization_verticals_one_primary
  on organization_verticals(organization_id) where is_primary;

-- Backfill: every existing org with business_type writes a primary row
insert into organization_verticals (organization_id, vertical_slug, is_primary)
select id, business_type, true from organizations
where business_type is not null
on conflict do nothing;
```

```sql
-- migration: 20260606_020000_product_capability_slugs.sql
alter table products
  add column capability_slugs text[] not null default '{}';

alter table categories
  add column default_capability_slugs text[] not null default '{}';

-- Backfill: existing inflatable products get the inflatable capability set
update products p
set capability_slugs = array['pricing.flat-day', 'setup.anchoring', 'setup.surface-type', 'mode.wet-dry']
from categories c
where p.category_id = c.id and c.vertical = 'inflatable';
```

### 5.2 Phase 1 — New capability columns

```sql
-- migration: 20260607_010000_per_hour_pricing.sql
alter table products
  add column hourly_rate_cents integer,
  add column minimum_hours integer,
  add column idle_hour_rate_cents integer;
```

```sql
-- migration: 20260607_020000_per_unit_pricing.sql
alter table products
  add column unit_price_cents integer,
  add column unit_label text;
```

```sql
-- migration: 20260607_030000_setup_window.sql
alter table products
  add column setup_minutes_before integer;
```

```sql
-- migration: 20260607_040000_capacity_display.sql
alter table products
  add column capacity_metric text
    check (capacity_metric in ('guests', 'sq_ft', 'dancers', 'servings')),
  add column capacity_value integer;
```

```sql
-- migration: 20260607_050000_product_specs.sql
create table product_specs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  spec_key text not null,
  spec_label text not null,
  spec_value text not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index on product_specs(product_id, display_order);
```

```sql
-- migration: 20260607_060000_onsite_attendant.sql
alter table products
  add column attendant_included_hours integer,
  add column attendant_overage_cents_per_hour integer;
```

```sql
-- migration: 20260607_070000_order_minimums.sql
alter table products
  add column minimum_order_quantity integer;
alter table categories
  add column minimum_order_cents integer;
```

### 5.3 Order line changes

```sql
-- migration: 20260607_080000_order_item_extensions.sql
alter table order_items
  add column billed_hours numeric(5,2),       -- per-hour pricing
  add column billed_units integer,             -- per-unit pricing
  add column attendant_overage_hours numeric(5,2);
```

Existing `order_items` rows are unaffected; new columns are nullable and populated only by capability-aware checkout paths.

---

## 6. File layout

```
lib/
  capabilities/
    types.ts                     ← Capability<T> generic, CapabilityGroup enum
    registry.ts                  ← all capabilities by slug
    pricing/
      flat-day.ts
      per-hour.ts
      per-unit.ts
    setup/
      anchoring.ts
      surface-type.ts
      setup-window.ts
    display/
      capacity-calculator.ts
      structured-specs.ts
    mode/
      wet-dry.ts
    service/
      onsite-attendant.ts
    order/
      minimum-order.ts

  verticals/
    types.ts                     ← VerticalConfig type
    registry.ts                  ← all verticals by slug, lookup helpers
    inflatables.ts
    tents.ts
    tables-and-chairs.ts
    dance-floors.ts
    photo-booths.ts
    concessions.ts

  pricing/
    compute-line-total.ts        ← dispatches to product's pricing capability

components/
  capabilities/
    pricing/
      PerHourFields.tsx
      PerUnitFields.tsx
    setup/
      AnchoringFields.tsx        ← extracted from product-form.tsx
      SetupWindowFields.tsx
    display/
      CapacityCalculatorWidget.tsx
      StructuredSpecsTable.tsx
    service/
      AttendantFields.tsx
    order/
      MinimumOrderBanner.tsx

  products/
    product-form.tsx             ← iterates product.capability_slugs, renders matching component
  storefront/
    product-detail.tsx           ← renders capability-driven sections

app/
  (marketing)/
    inflatable-rental-software/page.tsx
    tent-rental-software/page.tsx
    tables-and-chairs-rental-software/page.tsx
    dance-floor-rental-software/page.tsx
    photo-booth-rental-software/page.tsx
    concession-rental-software/page.tsx
```

The 6 marketing pages render a single shared `<VerticalLanding vertical={slug} />` component driven by `lib/verticals/<slug>.ts`.

---

## 7. Phased build plan

| Phase | Scope | Estimate | Ships |
|---|---|---|---|
| **0** | Foundation: capability/registry types, refactor inflatable into capability modules, `organization_verticals` migration, `capability_slugs` column. **Zero new behavior.** | 1–2 weeks | Internal-only (no user-visible change) |
| **1a** | `pricing.per-hour` capability | 1 week | Internal |
| **1b** | `pricing.per-unit` + `order.minimum-order` capabilities | 1 week | Internal |
| **1c** | `setup.setup-window` + `display.capacity-calculator` + `display.structured-specs` + `service.onsite-attendant` | 1 week | Internal |
| **2a** | Vertical landing pages: dynamic `[vertical]-rental-software` route + `<VerticalLanding>` component. Inflatables landing page ships. | 3 days | Public (inflatables /vertical page live) |
| **2b** | Ship Tents + Tables/Chairs + Dance floors (configs + content + images) | 1 week | Public (3 verticals live) |
| **2c** | Ship Photo booths + Concessions (configs + content + images) | 1 week | Public (5 verticals live) |
| **3** | Onboarding: multi-vertical signup picker, vertical-aware dashboard empty states, vertical-aware demo data seed | 1 week | Public (10/10 onboarding) |

**Total: ~7–8 weeks** from kickoff to all 5 verticals shipped at 10/10.

Parallel image sourcing happens during phases 1–2 (see §10).

---

## 8. Definition of "10/10 fit"

A vertical is at 10/10 when **all** of the following are true:

1. **Dedicated marketing page** at `/<vertical>-rental-software/` with vertical-specific hero, screenshots, copy, FAQ, testimonial.
2. **Vertical-specific product form** that surfaces only the fields relevant to that vertical (via capability composition).
3. **Vertical-specific storefront PDP** rendering specs, capacity calculator, mode/variant pickers as appropriate.
4. **Pricing model matches industry norm** — per-hour for photo booths/concessions, per-unit for tables/chairs, flat-day for tents/dance floors.
5. **Crew pull sheet renders vertical-specific setup info** (anchoring spec, setup window arrival time, power requirements, attendant assignment).
6. **Onboarding/demo data populated for that vertical** when org picks it at signup.
7. **i18n complete in en / es / fr / pt** for all capability labels used by the vertical.
8. **At least 3 vertical-specific images** (hero, crew/setup, inventory) in the marketing page.

Anything less than 10/10 should be called out in the vertical's config under `marketing.readinessNotes` so the operator-facing copy doesn't overpromise.

---

## 9. Parked decisions (Tier C+)

The following verticals are explicitly **deferred** until the first 5 ship and reach 50+ paying customers across them. They remain on the homepage industries strip (with implicit "we serve these too" framing) but get **no dedicated marketing pages and no capability work** until kickoff.

| Vertical | Why deferred |
|---|---|
| **Linens** | Needs `pricing.per-unit-bulk` (with tier discounts). Small standalone TAM. Operator overlap with tables/chairs — most linens customers already use that bundle. |
| **Bar equipment** | Small niche; reuses photo-booth/concession capabilities. Easy to add post-launch. |
| **Games & amusements** (mechanical bulls, dunk tanks) | Inflatable operator bundle play. Reuses `pricing.per-hour`. Sequencing question, not capability question. |
| **Generators** | Needs `pricing.multi-day-tiered`. Big market but dominated by Sunbelt/United Rentals. |
| **Restrooms** | Needs `pricing.multi-day-tiered`. Largest TAM but consolidated incumbents (United Site Services). |
| **Wedding decor** | Needs `composition.multi-item-bundle` + visual gallery UX. Most code work of any vertical. Defer to Phase B. |
| **AV / lighting / DJ** | Needs per-event tech-coordinator scheduling. Largest TAM but enterprise-skewed. |
| **Vehicles & fleet** (originally `05-vertical-roadmap.md` #2 recommendation) | Deferred indefinitely. The party-vertical expansion captures more of the existing inflatable-operator customer base. Revisit if/when a clear vehicle-rental customer demands it. |

---

## 10. Image sourcing (operator-side workstream)

For each shipped vertical, minimum **3 photos** (~7/10 fit) and target **5 photos** (10/10 fit):

| Slot | Use | Aspect |
|---|---|---|
| Hero | Operator + iPad next to vertical-specific inventory | 540×600 portrait |
| Crew | Crew member at work (setup or load) | 1100×400 landscape |
| Inventory | Warehouse/storage shot of stocked vertical | 1100×400 landscape |
| (10/10) Transition banner | Event in progress | 1100×400 landscape |
| (10/10) Customer phone | Storefront on phone screen | 540×600 portrait |

**Sourcing order** (so images arrive as code phases ship):
1. Tents, Tables/Chairs, Dance floors (during Phase 0–1)
2. Photo booths, Concessions (during Phase 1–2a)
3. Stock photo budget: ~$200–400 total via Adobe Stock / iStock if no operator photographer is available.

---

## 11. Migration & rollout safety

- **Non-breaking schema.** All new columns are nullable with sensible defaults. Existing inflatable code paths unaffected.
- **Capability assignment defaults.** When an org adds a vertical to `organization_verticals`, products created under that vertical's seeded categories get the vertical's `default_capability_slugs`. Operator can override per product.
- **Feature flag the new product form.** The capability-driven product form rolls out behind `flags.capability_product_form` so we can A/B against the current inflatable form before flipping defaults.
- **i18n contract preserved.** All four locales (en/es/fr/pt) ship with the same key set per capability. Type-checked via the existing `Messages` type in `lib/i18n/dictionaries.ts`.
- **Demo seed updated last.** `scripts/seed-demo.mjs` gets vertical-aware seeds in Phase 3 so demo tenants reflect the operator's verticals choice.

---

## 12. Open questions for ongoing review

1. **Visual backdrop picker for photo booths** — should the operator upload backdrop images directly, or link them as `product_assets` (a new generic capability)? Punt to Phase B.
2. **Multi-day rentals with per-hour pricing** — what's the daily-cap behavior for photo booths rented across 2 days? Default: hours pause at midnight; revisit if operators complain.
3. **Order minimum at storefront vs checkout** — block at the "Add to Cart" step or only at checkout? Decision: block at checkout to keep PDP friction low.
4. **`organizations.business_type` deprecation** — when do we remove the column? Plan: keep for 2 quarters after `organization_verticals` ships, then remove with a follow-up migration.

---

## 13. Research citations

Industry needs research per vertical (June 2026):

**Tents:**
- [Tent Rental Systems — feature breakdown](https://tentrentalsystems.com/)
- [Booqable — How to start a party tent rental business 2026](https://booqable.com/blog/how-to-start-a-party-tent-rental-business/)
- [gitnux.org — Top 10 Tent Rental Software 2026](https://gitnux.org/best/tent-rental-software/)

**Tables & chairs:**
- [chiavarichairrentals.org — nationwide pricing](https://www.chiavarichairrentals.org/) ($4.95/chair, $600 minimum)
- [Current Event Rentals — 2026 pricing guide](https://eventslv.com/cost-to-rent-tables-and-chairs/)

**Dance floors:**
- [Imperial Party Rentals — 2026 pricing](https://theimperialpartyrentals.com/blog/how-much-do-party-rentals-cost-in-los-angeles-2026-complete-price-guide/)
- [Reventals — Dance Floor Size Calculator](https://www.reventals.com/blog/dance-floor-rental/)
- [DC Electric Events — DC Dance Floor Rentals Costs](https://electriceventsdc.com/dc-dance-floor-rentals-costs/)

**Photo booths:**
- [Check Cherry — Photo Booth CRM features](https://www.checkcherry.com/photo-booth-crm)
- [Snappic — 7 Best Photo Booth Software 2026](https://www.snappic.com/resources/best-photo-booth-software)
- [Kande Photo Booths — 2026 pricing guide](https://www.kandephotobooths.com/blog/photo-booth-rental-prices/)
- [Pixilated — Essential Guide to Photo Booth Rental Business 2026](https://pixilated.com/blogs/main-blog/photo-booth-rental-business)

**Concessions:**
- [Freedom FUN USA Dallas — Concession rentals](https://www.freedomfunusa.com/category/concessions-dallas-texas)
- [GigSalad — Concessions for Hire](https://www.gigsalad.com/Event-Services/Concessions)
- [M&B Concessions — Service packages](https://www.mandbconcessions.com/cotton-candy-machines)

US market demand context (June 2026 IBISWorld + Goodshuffle/Booqable competitive overlap) — see `docs/strategy/05-vertical-roadmap.md`.

---

## 14. Changelog

| Date | Author | Change |
|---|---|---|
| 2026-06-05 | Claude (initial draft) | Document created. Supersedes the "vehicles & fleet as #2" recommendation in `05-vertical-roadmap.md`. Awaiting Phase 0 kickoff. |
