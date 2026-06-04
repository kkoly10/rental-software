# Inflatable Anchoring & Wet/Dry Modes (Sprint 6.0)

## Why this exists

Two real gaps in the inflatable vertical, both surfaced during the
post-launch architectural audit and validated against operator pain
in the field.

**Anchoring** is the #1 inflatable-rental safety + insurance lever.
ASTM F2374-22 mandates each anchor point resist 1600 N (~360 lbf),
and underwriters (Kelly Insurance, XINSURANCE, Cossio, Prime) treat
inadequate anchoring as a coverage-voiding material misrepresentation.
A 2022 BAMS/UGA study documented 132 wind-related incidents → 479
injuries → 28 deaths since 2000, over a third occurring at wind
speeds ≤20 mph that operators routinely dismiss. **No competitor
structures anchoring as data** — InflatableOffice asks the customer
to declare surface at booking and stops there; Goodshuffle / ERS /
TapGoods push everything to free-text. Modeling anchoring as
structured product attributes makes Korent the only vertical SaaS
where the crew dispatch sheet auto-shows "Bring 8 sandbags + ratchet
straps" for the right unit on the right surface.

**Wet/dry mode** is the second-most-asked operator feature after
recurring bookings. Combo units (5-in-1, 6-in-1) and slides under
~18 ft commonly support both modes; the operator's pricing model
typically adds a flat $25-75 upcharge to wet because of the 24-72hr
drying hold and cleanup labor. InflatableOffice handles this by
listing the same physical unit as **two SKUs** with linked
availability — a defensible pattern but it forces operators to
maintain two products and two pricing rows for every dual-mode unit.

## Design philosophy: noob-first, not enterprise-first

Same posture as Sprint 5.5 (equipment condition photos): the target
buyer is a Saturday-morning operator with three more deliveries to do.
Industry-standard "structure-everything" patterns get skipped or
populated with garbage.

**v1 ships:**

- Both features as **single optional product attributes** on existing
  `products` rows — not new SKUs, not new tables
- Operator UX is a single collapsed `<details>` accordion ("Inflatable
  setup") on the product form. If the operator doesn't expand it, no
  new fields appear and product creation looks identical to today.
- Customer UX surfaces only when the product has dual modes — a
  single radio toggle inline with the price. Single-mode products
  show nothing new.
- Crew dispatch sheet auto-renders "Bring: stakes + sandbags" when
  the booked product has anchoring methods set. Empty = nothing
  changes, crew uses memory like today.

**v1 explicitly skips** (deferred until operator pain justifies):

- Per-mode weather cutoff (43°F dry, 70°F wet) — operator policy, not
  per-product config
- Drying hold (24-72hr availability lockout after wet rental) — needs
  an availability-model change for ~5% of orders
- Wet→Dry day-of-delivery downgrade flow — courtesy operators handle
  by phone
- F2374 numeric force-rating per anchor — overengineering for a single
  industry-standard number
- Setup-photo-against-COI linking — equipment-condition photos
  already capture the artifact insurers want; the structural link can
  follow if an actual claim happens
- Per-anchor weight by surface (sandbag-on-asphalt = 200lb, indoor =
  150lb, etc.) — single `anchoring_methods` array is enough for v1;
  weight tables are a 5-day project that adds operator config burden
  for a feature 5% of operators care about

## Research summary

### Anchoring (industry + regulatory)

| Question | Answer |
|---|---|
| Governing standard | ASTM F2374-22 |
| Force per anchor point | 1600 N (~360 lbf) |
| Operational shutdown wind speed | 15 mph (default) |
| Anchor count source | Manufacturer specification, per SKU — F2374 delegates count to manufacturer design |
| Grass / soil method | 18-40" steel ground stakes, vertically driven |
| Hard surface method (asphalt / concrete / indoor) | Sandbags, water bags/barrels, or concrete weights via ratchet straps to D-rings |
| Typical anchor count by size | 13×13 bouncer: 4-6 / 15-20ft combo: 6-8 / 30ft slide: 8-12 / mega: 12+ |
| Insurance requirement | Photos of every unit + anchor points, certificate of insurance per event |

### Wet/dry (industry operations)

| Question | Answer |
|---|---|
| Which units support both | 5-in-1 / 6-in-1 combos and slides <18ft (manufacturer-designated) |
| Customer must provide | Garden hose within reach, GFCI outlet (same as dry) |
| Operator must bring | Sprayer attachment + removable splash pool |
| Setup time delta | ~5-10 min wet over dry |
| Pricing pattern | Flat $25-75 wet upcharge (cleanup amortization, not water cost) |
| Sanitation hold after wet | 24-72hr drying before next rental |
| Booking flow standard | InflatableOffice: two SKUs sharing inventory; Goodshuffle: accessory toggle; TapGoods/ERS: free-text |
| Cold-weather wet cutoff | ~70°F (soft); dry hard cutoff ~42-43°F |

### Competitor handling of these features

| Product | Wet/dry pattern | Anchoring pattern |
|---|---|---|
| InflatableOffice | Two linked SKUs (best in vertical for wet/dry) | Customer declares surface; no structured data |
| Goodshuffle Pro | Accessory / add-on | Free-text on dispatch sheet |
| Event Rental Systems | Duplicate SKUs by operator | Free-text |
| TapGoods PRO | None native | None native |

**Korent's intended position**: single product with mode toggle
(better operator UX than InflatableOffice's two-SKU model) + structured
anchoring methods on the dispatch sheet (better than every
competitor). Best-in-vertical on both axes.

## Data model

Two columns on `products`, one column on `order_items`. No new tables.

```sql
alter table public.products
  add column if not exists supports_modes text[] not null default '{dry}'::text[],
  add column if not exists wet_upcharge_cents integer,
  add column if not exists anchoring_methods text[] not null default '{}'::text[],
  add column if not exists required_anchor_count integer;

alter table public.order_items
  add column if not exists selected_mode text;

-- CHECK constraints
alter table public.products
  add constraint products_supports_modes_check
  check (supports_modes <@ '{dry,wet}'::text[] and array_length(supports_modes, 1) >= 1);

alter table public.products
  add constraint products_anchoring_methods_check
  check (anchoring_methods <@ '{stakes,sandbags,water_barrels,concrete_weights,tie_downs}'::text[]);

alter table public.order_items
  add constraint order_items_selected_mode_check
  check (selected_mode is null or selected_mode in ('dry','wet'));
```

Why these column choices:

- **`supports_modes` defaults to `{dry}`** so every existing product
  keeps its current single-mode behavior with zero migration. The
  CHECK enforces "at least one mode" so an operator can't accidentally
  unlist every booking option.
- **`wet_upcharge_cents` is nullable** — it's only meaningful when
  `wet` is in `supports_modes`. Storing cents (not dollars) matches the
  existing `base_price` convention and avoids float drift in pricing.
- **`anchoring_methods` defaults to empty array** — products without
  this configured render exactly like today.
- **`required_anchor_count` is nullable** — operator may know this
  from the manufacturer or may not. Storing as integer lets the crew
  sheet say "Bring 8 sandbags" when set, or just "Bring sandbags"
  when unset.
- **`order_items.selected_mode` is nullable** — only set when the
  parent product has dual modes. NULL means "this isn't a
  mode-aware product" and the existing checkout/pricing flow is
  untouched.
- **All constraints are additive** — no `not null`, no destructive
  changes, no backfill needed. The migration is safe to apply on a
  live database with existing orders.

## Operator UX

Product create / edit form adds one collapsed accordion at the bottom
of the form, ONLY rendered when the product's category vertical is
`inflatable`:

```
▸ Inflatable setup (optional)
   ├─ Anchoring methods    [✓] Stakes  [✓] Sandbags
   │                       [ ] Water barrels  [ ] Concrete weights  [ ] Tie-downs
   ├─ Required anchors     [ 6  ] (per manufacturer spec)
   ├─ Available modes      [✓] Dry  [✓] Wet
   └─ Wet upcharge         [ $50 ]  (added to base price when customer picks wet)
```

If the operator doesn't expand the section, no fields appear and the
existing product form behavior is identical. Existing products keep
their `supports_modes = {dry}`, `anchoring_methods = {}` defaults.

When the operator unchecks `Wet` while saving, the form clears any
`wet_upcharge_cents` value to avoid an orphaned upcharge for a mode
the product no longer supports.

## Customer UX

Product detail page on the storefront renders a mode toggle ONLY when
`supports_modes` contains both `dry` and `wet`. Single-mode products
behave identically to today.

```
Tropical Combo 5-in-1
$300 / day

How will you use it?
  ◉ Dry mode     $300
  ○ Wet mode     $350  (we bring the sprayer + splash pool; you provide a garden hose)

[Check availability]
```

The selected mode is propagated through checkout state and persisted
on the corresponding `order_items` row as `selected_mode`. Line-total
calculation in `lib/checkout/actions.ts` adds `wet_upcharge_cents` to
the base price when `selected_mode = 'wet'`.

If the product has only `{dry}` or only `{wet}` in `supports_modes`,
no toggle renders, the selected mode is captured implicitly, and the
line total is the base price unchanged.

## Crew UX

The pull sheet (`/dashboard/deliveries/[id]/pull-sheet`) and the crew
today page (`/crew/today`) both render anchoring + mode hints inline
with each item:

```
Stop 2 — Velasquez Birthday Party · 11:30 AM
   123 Maple St, Tampa FL
   • Tropical Combo 5-in-1 (Wet)
     Bring: stakes ×6, splash pool, sprayer
```

The "Bring:" line is computed from:

- The product's `anchoring_methods` (rendered as a comma-separated
  list with friendly labels — "stakes", "sandbags", "water barrels")
- `required_anchor_count` if set (rendered as "×6"); omitted when
  null
- Mode-specific extras (`splash pool`, `sprayer`) when
  `selected_mode = 'wet'`

Products with no anchoring data simply omit the "Bring:" line and the
crew sheet looks identical to today.

## Pricing model

Single rule: `line_total = base_price + (selected_mode = 'wet' ? wet_upcharge_cents : 0)`.

Implemented in `lib/checkout/actions.ts` line-total calculation, with a
unit test pinning:

- Single-mode product → line total = base price
- Dual-mode product, dry selected → line total = base price
- Dual-mode product, wet selected, upcharge set → line total = base +
  upcharge
- Dual-mode product, wet selected, upcharge null/zero → line total =
  base price (no surprise charges if the operator forgot to set the
  upcharge)

The wet upcharge does NOT compound across quantity — it's per-unit,
not per-line. So a customer renting two wet slides at $300 + $50
upcharge each pays `2 × ($300 + $50) = $700`, not `2 × $300 + $50 =
$650`. Matches industry pattern.

## Migration safety

- All schema changes are additive. No destructive `drop`, no `not null
  without default`, no backfill required.
- Existing products keep `supports_modes = {dry}`, `anchoring_methods
  = {}` by default — their storefront, checkout, pull-sheet, and order
  detail experiences are unchanged.
- Existing orders' `order_items` keep `selected_mode = null` — pricing
  recompute and line-total displays continue to work as today.
- The migration is safe to apply mid-traffic via Supabase MCP, then
  the code change rolls out next deploy. Forward-compatible: old code
  ignores the new columns; new code falls back to defaults when the
  columns are null/empty.

## Surfaces touched (per the recon)

| Layer | File | Change |
|---|---|---|
| Schema | `supabase/migrations/20260605_010000_inflatable_setup.sql` | New columns + CHECK constraints |
| Product form | `components/products/product-form.tsx` | New collapsible accordion (vertical-gated) |
| Product server actions | `lib/products/actions.ts` | Accept + validate new fields |
| Product validation schema | `lib/validation/products.ts` | Zod schema additions |
| Storefront detail | `app/inventory/[slug]/page.tsx` + `lib/data/catalog-detail.ts` | Mode toggle when dual-mode |
| Checkout state | `components/checkout/checkout-form.tsx` | Carry selected mode |
| Checkout action | `lib/checkout/actions.ts` | Apply wet upcharge, persist `selected_mode` on order_items |
| Order detail page | `app/dashboard/orders/[id]/page.tsx` + `lib/data/order-detail.ts` | Render mode badge next to item |
| Pull sheet | `lib/logistics/pull-sheet.ts` + `app/dashboard/deliveries/[id]/pull-sheet/page.tsx` | Render "Bring:" line |
| Crew today | `app/crew/today/page.tsx` | Render "Bring:" line |
| Tests | `tests/wet-upcharge.test.ts` | Pin line-total pricing |
| i18n | `lib/i18n/messages/{en,es,fr,pt}.ts` | Mode labels, anchoring method labels, "Bring:" prefix |

## Effort

| Slice | Days |
|---|---|
| Migration + types regen | 0.5 |
| Operator product form accordion | 1.0 |
| Storefront mode toggle | 0.5 |
| Checkout pricing + persistence | 0.5 |
| Order detail + pull-sheet + crew rendering | 0.5 |
| i18n across 4 locales | 0.5 |
| Pricing tests | 0.5 |
| **Total** | **~4 days** |

Tighter than my pre-recon estimate (5-6 days) because (a) no new
tables, (b) both features share one operator-form accordion, (c)
checkout per-item options pattern is established in a way the team
can reuse for the next per-item feature.

## Open questions for the operator

1. **Wet upcharge default**: do you want a per-org default
   (e.g. "$50 wet upcharge unless overridden") or always per-product?
   I'd recommend per-product only — operators with one wet unit
   would never use the org default anyway, and operators with many
   want different upcharges per unit (a 13ft combo costs less to dry
   than a 30ft slide).
2. **Allow saving an orphan upcharge?** If an operator unchecks
   "Wet" but leaves the upcharge field at $50, do we clear it (safer)
   or preserve it for when they re-enable wet (more user-friendly but
   risks ghost data)? Recommendation: clear it server-side on save.
3. **Anchoring methods list extensibility**: the CHECK constraint
   pins five values (`stakes`, `sandbags`, `water_barrels`,
   `concrete_weights`, `tie_downs`). Adding a sixth requires a
   migration. Acceptable tradeoff vs. free-text drift, but the
   operator survey loop should re-check the list every 6 months.

## References

- ASTM F2374-22 — https://store.astm.org/f2374-22.html
- SIOTO — https://sioto.com/
- Kiefer et al., "Wind-Related Bounce House Incidents," BAMS 103(10),
  2022 — https://journals.ametsoc.org/view/journals/bams/103/10/BAMS-D-21-0160.1.xml
- InflatableOffice features — https://inflatableoffice.com/features/
- Goodshuffle Pro inflatables — https://pro.goodshuffle.com/industries/inflatable-rental-software/
- Kelly Insurance underwriting — https://kellyinsurancegroup.com/inflatables-and-bounce-house-insurance/
- Magic Jump dual-mode units catalog — https://www.magicjump.com/bounce-house-with-slide/
