# Korent Marketplace — Master Plan (side project)

> **Status: PLANNED — not in active build.**
> Active work remains the operator-SaaS launch-readiness program
> (PR-1/2/3 in `docs/qa/multi-vertical-launch-plan.md`) and Stripe
> Connect Express onboarding for operator payments. This document is
> the system-of-record for the marketplace side project so it can be
> picked up later without re-deriving decisions. Nothing in here
> changes the operator SaaS, storefront, auth, onboarding,
> multi-tenant model, or RLS posture.

## Decision record — how payments split across the two products

| Surface | Payment architecture | Platform fee |
|---|---|---|
| **Operator SaaS** (current build) | Stripe Connect **Express** — operator onboards once, customer payments settle to the operator's bank | **None** (Option A: subscription-only; Korent monetizes via `organizations.subscription_plan`) |
| **Marketplace** (this plan) | Same Connect Express accounts, marketplace checkout uses destination charges + `application_fee_amount` | **12%** marketplace sellers / **8%** Korent operators, **$4 minimum**, **no fee on refundable deposit holds** |

Build-once implication: the Connect Express onboarding, account-status
columns, and webhook handling built for the operator SaaS are the
same infrastructure marketplace payouts ride on. Land Connect in the
operator SaaS first; the marketplace inherits it.

---

## 0. Primary objective

Build a trusted multi-world rental marketplace for expensive things
people need temporarily.

Marketplace worlds:

- Home & Projects
- Hosting & Events
- Baby Gear
- Creator Gear
- Trailers & Hauling
- Office & Pop-Up
- Seasonal & Emergency

The marketplace should feel like eBay/Amazon for browsing, like
Turo/Airbnb for booking and trust, and like a serious operational
platform under the hood.

It must support: verified renters and sellers, seller storefronts,
listing publication, pricing intelligence, deposits/holds,
reservation locks, pickup/return evidence, disputes and support,
in-app messaging, seller payouts, operator fulfillment projection,
and admin/trust tooling.

---

## 1. Repo audit — what already exists to reuse

Audited 2026-06-10 against `main` (post-#316 + PR-1 branch). The
operator SaaS already carries direct precursors for most of the
shared core the spec calls for:

| Spec requirement | What exists today | Reuse verdict |
|---|---|---|
| organizations / profiles / memberships | `organizations`, `profiles`, `organization_memberships`, `team_invites` with role-gated RLS (owner/admin/dispatcher/crew/viewer) | ✅ shared core as-is; marketplace-only sellers become orgs with lighter tooling (spec §22) |
| products + assets | `products` (pricing_model: flat_day/per_day/per_unit/per_hour, `capability_slugs[]`, `security_deposit_amount`, `minimum_order_quantity`), `assets` (serialized, operational_status) | ✅ inventory modes map: serialized = `assets`, quantity-based = per-unit products; bundle/composite = `product_addons` + `order_items.parent_order_item_id` |
| availability engine | `availability_blocks` + `reserve_availability_if_available` RPC (advisory-lock atomic insert), `checkout_hold` with 30-min TTL, `/api/cron/cleanup-holds` | ✅ direct precursor of the reservation-hold model (§10); needs the extra states + standby queue |
| turnaround buffers | `products.setup_minutes_before` + `breakdown_minutes_after` wired into the availability window (PR-1 #3) | ✅ identical to §14's prep/recovery buffers — rename only |
| pricing primitives | `lib/pricing/engine.ts`, capability pricing helpers (`per-unit`, `per-hour`), pricing rules with % adjustments | ✅ foundation for §8's pricing engine; benchmark library + bands are new |
| policy/capability registry | `lib/capabilities/**` registry + `lib/verticals/**` per-vertical config | ✅ the exact pattern §5–6 wants — extend to worlds/categories/risk-families as `policy-registry` |
| tax | `tax_rules` per-jurisdiction (org, state, postal_code) (PR-1 #1) | ✅ §15's "jurisdiction-configurable tax" already started |
| payments + idempotent event handling | `payments` table (+ `stripe_refund_id`), Stripe webhook ledger state machine (`stripe_webhook_events.processing_status` × `attempt_count`, TOCTOU-safe re-claim) | ✅ precursor of §27's outbox/inbox idempotency pattern |
| evidence chain | `documents` signing (signer_ip / user_agent / signature_data_url), `route_stops` proof photos + signatures | ✅ pattern for §16 pickup/return evidence; marketplace needs its own tables |
| messaging primitives | `communication_log`, portal send-message route with rate-limits | ⚠️ too thin — §18/§26's conversation system is new build, but the rate-limit + portal-token patterns carry over |
| observability/audit | `logAppEvent` / `logAppError`, app_events | ✅ shared |
| security plumbing | `lib/security/rate-limit`, action-client keys, demo-write guard, portal access tokens (hashed, expiring) | ✅ shared |
| i18n | `lib/i18n` (en/es/fr/pt) cookie-based locale | ✅ shared |
| test harness | unit (node:test), smoke (Playwright API), E2E journeys, RBAC suite | ✅ extend with marketplace journeys |

**Genuinely new build** (no precursor): seller storefront pages,
marketplace listings + publication workflow, renter-facing booking
state machine, reviews, search/ranking, verification workflows
(ID/liveness), benchmark ingestion pipeline, deposit engine,
disputes/claims, chargeback cases, payout ledgers, messaging +
moderation engine, trust queues/admin surfaces, anti-leakage.

## 2. Isolation boundary

**Shared core** (today's code, consumed by both apps):
organizations, profiles/memberships, products, assets, media storage
primitives, location/address primitives, availability engine
primitives, pricing primitives, notifications infrastructure,
audit/event infrastructure.

**Marketplace-only**: seller storefronts, marketplace listings,
category/risk-based listing publication, booking reservations,
marketplace bookings, reviews, ranking/search metrics, messaging,
verification workflows, proof-of-function media, pickup/return
evidence, disputes/claims, payout logic, anti-leakage logic.

**Operator-only**: internal dashboard ops, CRM-like order pipeline,
route board/logistics, internal accounting views, staffing/crew
workflows, internal documents workflow.

**Bridge model**: a marketplace booking is NOT a raw operator order.
The marketplace owns the renter-facing commercial lifecycle; the
operator owns the fulfillment projection lifecycle. On confirmation
the marketplace emits bridge events and the operator side creates a
fulfillment projection (see §27).

Hard rules:

- Do NOT make the marketplace a thin page inside the operator app.
- Do NOT reuse operator page actions/components for marketplace logic.
- Do NOT duplicate the booking/availability engine in an independent codebase.

## 3. Proposed folder/package plan

The repo today is a single Next.js app. Phase 1 includes the
workspace split (npm workspaces; no behavior change to the deployed
operator app until the marketplace surface ships):

```
apps/
  operator/        ← current app/ moves here (deployed as today)
  marketplace/     ← new renter/seller-facing Next.js app
  admin/           ← trust/admin surfaces (can start as routes inside operator, split later)
packages/
  rental-core/     ← extracted: availability, pricing primitives, product/asset types
  marketplace-domain/  ← listings, bookings, reservations, reviews
  trust-safety/    ← verification, moderation rules, leakage scoring
  payments-core/   ← Stripe Connect, ledgers, deposit engine
  policy-registry/ ← worlds, categories, risk families, restricted items
  event-bus/       ← outbox/inbox, bridge event contracts
  ui-tokens/       ← design tokens only (no shared components)
```

Marketplace tables live in a bounded Postgres schema
(`marketplace.*`) in the same Supabase project, preserving the
existing RLS discipline with marketplace-specific policies.

---

## 4. World taxonomy

Top-level worlds: `home-and-projects`, `hosting-and-events`,
`baby-gear`, `creator-gear`, `trailers-and-hauling`,
`office-and-pop-up`, `seasonal-and-emergency`.

Every listing must have: 1 world slug, 1 category slug, 1 risk
family slug, optional secondary tags.

Secondary tags (cross-world behavior): `furniture`,
`event-furniture`, `office-furniture`, `staging-furniture`,
`lounge-furniture`, `powered-equipment`, `motorized-equipment`,
`electric-equipment`, `high-value`, `high-fraud-risk`,
`manual-review-preferred`, `child-contact`, `food-contact`,
`sanitation-sensitive`, `delivery-heavy`, `pickup-preferred`,
`onsite-setup`, `multi-component`, `serial-required`,
`vin-required`, `restricted-item`, `age-restricted`.

## 5. Category tree

**home-and-projects**: access-and-ladders, yard-and-landscaping,
cleaning-and-restoration, flooring-and-interior-finishing,
cutting-drilling-and-demolition, painting-and-surface-prep,
power-and-jobsite-support, staging-and-temporary-furniture,
inspection-and-specialty.

**hosting-and-events**: tents-and-canopies, tables,
chairs-and-seating, lounge-and-event-furniture,
dance-floors-and-staging, photo-booths,
concessions-and-food-service, audio-visual-and-presentation,
climate-and-comfort, decor-and-backdrops, games-and-entertainment,
event-utility-equipment.
*(Note: overlaps Korent's existing operator verticals — Korent
operators list into these categories at the 8% fee.)*

**baby-gear**: sleep-and-nursery, strollers-and-mobility,
feeding-and-mealtime, monitoring-and-safety, play-and-soothing,
travel-and-on-the-go, premium-support-gear.

**creator-gear**: cameras-and-bodies, lenses-and-optics,
audio-and-podcast, lighting-and-grip, support-and-stabilization,
streaming-and-production, backgrounds-and-sets,
monitors-and-accessories, event-capture-systems.

**trailers-and-hauling**: utility-and-flatbed-trailers,
enclosed-trailers, dump-trailers, vehicle-transport,
moving-equipment, cargo-carriers-and-hitch-gear,
tie-down-and-hauling-accessories.

**office-and-pop-up**: desks-and-workstations, chairs-and-seating,
tables-and-meeting-furniture, displays-and-signage,
presentation-and-av, pos-and-check-in, printing-and-scanning,
wifi-power-and-connectivity, booth-fixtures-and-merch-displays,
office-furniture.

**seasonal-and-emergency**: backup-power,
water-damage-and-restoration, heating-and-cooling,
storm-and-cleanup, snow-and-ice, temporary-lighting-and-safety,
pumps-and-drainage, temporary-shelter-and-site-protection.

## 6. Risk families

`passive-standard`, `furniture-standard`, `powered-standard`,
`electronics-standard`, `high-value-electronics`, `towable-road`,
`baby-sensitive`, `food-contact`, `restoration-and-emergency`,
`multi-component-event`, `manual-review-restricted`.

Categories map to risk families in the policy-registry layer.

## 7. World/category operating matrix

Each category/risk family must resolve these defaults (risk-family
defaults exist; world/category overrides may refine them):

booking mode, deposit mode, proof-of-function required?, sanitation
class, identity verification level, seller review requirement,
instant-book allowed?, delivery allowed?, default cancellation
preset, dispute sensitivity, minimum booking subtotal, late
fee/extension default, accessories checklist requirement,
serial/asset identity requirement, proof freshness interval,
restricted/prohibited rules, return inspection template.

## 8. Inventory model

Exactly 3 modes — a listing is never two at once:

1. **serialized** — one asset record = one rentable unit (trailers,
   cameras, generators, projectors, high-value units). Maps to the
   existing `assets` table.
2. **quantity-based** — reserve quantity, not a specific unit
   (chairs, tables, commodity inventory).
3. **bundle/composite** — booking reserves required components +
   optional add-ons (tent packages, AV kits, booth kits, camera
   kits, trailer bundles). Builds on `product_addons` +
   `order_items.parent_order_item_id`.

Add-ons classify as **non-reservable** (pricing only) or
**reservable** (pricing + availability impact).

## 9. Pricing engine

Deterministic, DB-configured, benchmark-backed. Five layers:
pricing policy library → benchmark library → pricing engine service
→ seller calculator → optional auto-pricing mode.

Category-family target bands (daily rate as % of replacement value):

| Risk family | Target daily |
|---|---|
| passive-standard | ≈ 4% |
| furniture-standard | ≈ 5.5% |
| powered-standard | ≈ 10% |
| electronics-standard | ≈ 6.5% |
| high-value-electronics | ≈ 4% |
| towable-road | ≈ 3.5% |
| baby-sensitive | ≈ 5% |
| food-contact | ≈ 6.5% |
| restoration-and-emergency | ≈ 12% |
| multi-component-event | ≈ 7.5% |

Engine outputs: hourly/day/weekend/weekly recommendations,
low/recommended/premium bands, deposit recommendation, delivery
recommendation, payout after platform fee, recover-cost estimate,
confidence level, deterministic explanation.

Fee defaults: **12%** marketplace seller fee, **8%** Korent
operators, **$4 minimum** platform fee, **no fee on refundable
deposit holds**.

## 10. Deposit engine

Risk-based and time-aware.

```
estimated_used_value = replacement_value × age_factor × condition_factor

age:       0–12mo 0.85 · 1–3y 0.70 · 3–5y 0.55 · 5y+ 0.40
condition: new 1.00 · excellent 0.95 · good 0.85 · fair 0.70 · worn 0.50

base_deposit = (estimated_used_value × risk_family_pct)
             + (high_risk_accessories_value × 0.50)
```

Clamp by category floor/cap; never exceed estimated used value.

| Risk family | % | Floor |
|---|---|---|
| passive-standard | 15% | $50 |
| furniture-standard | 20% | $75 |
| powered-standard | 25% | $100 |
| electronics-standard | 25% | $100 |
| high-value-electronics | 35% | $250 |
| towable-road | 40% | $300 |
| baby-sensitive | 20% | $75 |
| food-contact | 20% | $75 |
| restoration-and-emergency | 30% | $150 |
| multi-component-event | 25% | $150 |

Strategies: `none`, `auth_hold`, `captured_refundable`,
`manual_review`.

**Critical rule**: do NOT place damage authorization holds too
early — place them close to pickup/handoff. Auth holds only when the
safe hold window ≤ 96 hours; otherwise captured refundable deposit.
`towable-road` and `high-value-electronics` lean stricter.

## 11. Reservation hold / expiry model

States: `none`, `checkout_hold`, `verification_hold`,
`awaiting_seller`, `awaiting_renter_payment`, `confirmed`,
`expired`, `released`.

TTLs: checkout_hold 15 min · verification_hold +15 min (30 min max
combined) · awaiting_seller 2 h · awaiting_renter_payment 30 min.

**Standby queue**: one active hard hold per inventory slot;
additional interest sits in standby (does not block inventory) and
is promoted when the hold expires. Hold cleanup runs every 5 min
(extends the existing `/api/cron/cleanup-holds`). Availability
considers hard holds + confirmed availability blocks.

## 12. Geo benchmark ingestion

Reviewed pipeline — never raw scraping into pricing:
raw capture → normalization → review/outlier filtering → published
benchmark snapshots.

Geo fallback chain: exact metro/city cluster → state/region → ZIP3
prefix → national same-category → national same-risk-family.

Cadence: nightly internal rollups, weekly manual/public-source
updates, nightly snapshot publish after validation. Confidence
levels: high/medium/low. At launch, prioritize curated manual
inputs + internal marketplace data over automation.

## 13. Verification / trust

Progressive: signup (email + phone) → before first booking
(identity, selfie/liveness, payment method) → before first payout
(seller KYC / Stripe Connect onboarding, payout details, business
info if needed).

Stricter rules for: trailers-and-hauling, high-value-electronics,
certain baby-sensitive and powered-standard categories.

## 14. Booking model

v1: **one primary listing per booking** — no multi-seller cart.

State machine: `draft` → `pending_verification` →
`pending_seller_approval` → `awaiting_payment` → `confirmed` →
`ready_for_handoff` → `checked_out` → (`overdue`) →
`returned_pending_review` → `completed`, with `cancelled` and
`disputed` as exits. Marketplace owns this lifecycle.

## 15. Turnaround / availability buffers

Every listing supports `prep_buffer_before_minutes` +
`recovery_buffer_after_minutes`:

```
effective_start = requested_start − prep_buffer_before
effective_end   = requested_end   + recovery_buffer_after
```

(Identical mechanics to `setup_minutes_before` /
`breakdown_minutes_after` shipped in PR-1 — reuse, don't rebuild.)

Default family buffers:

| Risk family | Prep | Recovery |
|---|---|---|
| passive-standard | 0–60m | 60m |
| furniture-standard | 2h | 4h |
| powered-standard | 2h | 12h |
| electronics-standard | 1h | 4h |
| high-value-electronics | 2h | 24h |
| towable-road | 4h | 24h |
| baby-sensitive | 4h | 24h |
| food-contact | 4h | 24h |
| restoration-and-emergency | 1h | 12h |
| multi-component-event | 6–24h | 12–24h |

## 16. Payments, tax, reporting, chargebacks

Stripe Connect for payouts (Express, shared with operator SaaS).

Separate ledgers: booking ledger, seller settlement ledger, tax
ledger, reporting ledger.

Tax responsibility is **jurisdiction-configurable** (marketplace-
facilitator rules vary by state) and must be legally reviewed per
launch jurisdiction — do not hard-code one assumption. The
`tax_rules` pattern extends here.

**Chargebacks are a separate system from marketplace disputes**:
freeze seller payout balance for the affected booking, freeze
unreleased funds if needed, create a chargeback case, generate an
evidence bundle, track the issuer deadline separately from internal
dispute SLA. Internal dispute + chargeback may coexist; chargeback
state controls money movement.

## 17. Pickup / return evidence (mandatory)

**At pickup** — seller submits condition photos, proof-of-function
where required, accessories checklist; renter submits
acknowledgment photos, visible-condition acknowledgment, working
acknowledgment where relevant.

**At return** — renter submits return photos + accessory return
checklist; seller submits inspection photos + issue report if
damaged/missing/dirty/late.

All evidence links to the booking and is preserved for disputes.

## 18. Disputes / claims

Types: `item_not_working`, `damage`, `missing_accessories`,
`late_return`, `non_return`, `condition_mismatch`,
`seller_no_show`, `renter_no_show`, `billing_issue`.

Statuses: `open` → `awaiting_renter_evidence` /
`awaiting_seller_evidence` → `admin_review` →
`resolved_renter_liable` / `resolved_seller_liable` /
`resolved_split` / `resolved_no_fault` → `closed`.

Admin powers: request evidence, freeze payout-related funds, decide
claim allocation, apply deposit partially/fully, mark insufficient
evidence.

## 19. In-app messaging

One visible conversation system with hidden commerce phases.

Visible UX: free-form chat by default, structured actions as
optional helpers, one continuous thread (inquiry → booking →
support), support/admin can join in-thread, system cards inline.

Hidden phases: `inquiry`, `booking_requested`, `awaiting_payment`,
`confirmed`, `handoff_window`, `active_rental`, `return_window`,
`case_open`, `completed`, `restricted`, `archived`.

Supports: listing inquiries, booking coordination, extension
requests, issue reports, support/dispute communication.

Hard-block only: off-platform payment instructions, early
phone/email/address sharing, malicious links, serious fraud/abuse.
Soft-warn suspicious-but-not-forbidden behavior.

Messaging performance feeds seller trust score, response-time
score, and ranking. Dedicated marketplace conversation tables with
controlled write paths — not generic unrestricted chat.

## 20. Support / moderation ops

Five queues: listing moderation · trust & verification · booking
support · disputes & claims · payments & chargebacks.

SLAs: P0 safety/fraud/chargeback freeze <1h · P1 booking-blocking
<4h · P2 listing moderation/verification <24h · P3 non-urgent
seller help 1–2 business days · disputes: acknowledge immediately,
evidence 48h, simple resolution 72h, complex 5 business days.

Auto-decision rules: expired holds, missing required identity step,
prohibited item listings, no seller response by SLA, low-risk
extension approvals with no conflict.

## 21. Messaging moderation

Rule table + moderation engine.

Hard-block: direct phone number before allowed stage, direct email
before allowed stage, payment handles / external payment
instructions, exact address too early, malicious links, fraud
phrases, severe abuse.

Soft-warn: "I can do cheaper outside the app", social handles,
suspicious shortened links, repeated attempts to move the
conversation elsewhere.

Leakage risk score with escalating actions: thread flag → account
review → thread restriction → trust escalation.

## 22. Search / ranking

Inputs: availability, distance, listing quality score, media
completeness, proof-of-function presence where required, seller
verification, response time, inquiry response rate, completion
rate, dispute rate, cancellation rate, conversion history.
**Never rank purely by price.**

## 23. Seller storefronts

Each seller: store name, slug, logo/banner, description, service
radius, pickup/delivery flags, ratings + review count, verification
badges, response-time indicators, live inventory.

Korent operators and marketplace-only sellers both fit the
organization model; marketplace-only sellers get lighter operator
tooling.

## 24. Seller economics

- Marketplace sellers: **12%** fee, $4 minimum platform fee
- Korent operators: **8%** fee, same minimum unless explicitly overridden
- No platform fee on refundable deposit holds

Pricing UI shows: recommended prices, estimated payout after fee,
recover-cost estimate, low/recommended/premium bands, confidence
level.

## 25. Communications matrix

Stage-based rules: pre-booking (masked contact, in-platform only) →
booking requested (seller response SLA, still masked) → confirmed
pre-handoff (operational coordination opens gradually) → active
rental (extensions/issues allowed) → return (coordination +
evidence prompts) → case open (support/admin-driven).

Notifications: inquiry, seller response needed, booking
approved/rejected, payment captured, pickup reminder, return
reminder, extension request, issue report, dispute opened, case
resolved, payout released.

## 26. Restricted / prohibited items

Four restriction levels: `prohibited`, `restricted_manual_review`,
`allowed_with_extra_requirements`, `allowed_standard`.

Prohibited or heavily restricted: firearms/ammo, explosives,
hazardous chemicals, illegal surveillance equipment, recalled baby
products, unsafe/unverifiable trailers, medical/life-support
devices without special compliance, stolen/unverifiable property.

A policy registry + explicit seed list is required; geography-
sensitive items get flagged for manual legal review.

## 27. Messaging technical model

Tables: marketplace conversations, participants, messages,
attachments, moderation events, structured actions, conversation
events, support cases. Read-through RLS + controlled write
functions/server actions — no free-form client inserts into core
messaging tables.

## 28. Event bridge: marketplace → operator

Outbox/inbox pattern with idempotency (extends the webhook-ledger
state machine pattern already proven in
`stripe_webhook_events.processing_status`).

Marketplace emits: `marketplace.booking.confirmed`, `.cancelled`,
`.ready_for_handoff`, `.checked_out`, `.overdue`,
`.returned_pending_review`, `.completed`,
`marketplace.dispute.opened`, `.resolved`.

Operator maintains the fulfillment projection
(`ops.fulfillment_order`, asset prep tasks, inspection tasks,
delivery tasks) and emits back: `ops.fulfillment.ready_for_handoff`,
`ops.handoff.pickup.completed`, `ops.return.inspection.completed`,
`ops.asset.maintenance.flagged`, `ops.asset.back_in_service`.

Marketplace = source of truth for the commercial lifecycle;
operator = source of truth for fulfillment.

## 29. Build order

1. **Phase 1** — bounded app/package structure (workspace split),
   policy registry, world/category/risk-family config, restricted
   item policy, seller storefront model, marketplace listing model
2. **Phase 2** — inventory modes, reservation holds, booking
   engine, turnaround buffers, pickup/return evidence model
3. **Phase 3** — pricing library schema, benchmark library, pricing
   engine, seller calculator, pricing admin tools
4. **Phase 4** — verification/trust, Stripe Connect payouts,
   deposit engine, ledgers, tax/reporting scaffolding, chargeback
   case model
5. **Phase 5** — messaging system, moderation rules, support cases,
   in-thread admin join, notifications
6. **Phase 6** — disputes/claims, search/ranking, quality scoring,
   anti-leakage, review system
7. **Phase 7** — operator bridge events, fulfillment projection,
   admin/trust surfaces, analytics + launch-readiness tooling

## 30. Implementation ground rules

- Clean migrations; marketplace tables in a bounded schema
- Preserve existing auth / multi-tenant / RLS discipline
- No silent changes to operator flows
- Deterministic rule systems over vague AI behavior
- Every progress report includes: what was audited, what was
  reusable, what was added, files modified, migrations added, env
  vars/providers required, unresolved items, exact local test steps

## 31. Explicitly undecided — do not fake these

Flag in code rather than pretending they're done:

- exact launch jurisdictions + marketplace-facilitator tax setup
- exact KYC/ID provider choice (Stripe Identity vs Persona vs Veriff)
- final restricted-items legal review by geography
- launch metro / liquidity targets
- final benchmark seed data coverage by category
- support staffing assumptions
- final notification channel/provider policy

Build so these are configurable later without redesign.
