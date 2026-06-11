# Korent Marketplace — Build Plan

Execution counterpart to [`MARKETPLACE_MASTER_PLAN.md`](MARKETPLACE_MASTER_PLAN.md) (the spec) and its section 31 launch scope. Follows the repo convention: spec/strategy docs say *what and why*; this doc says *how, in what order, with what gates*.

**Date**: June 2026 · **Status: M0–M6 SHIPPED (June 11, 2026)** — all six
sprints are merged to main. Eight `20260611_*` migrations await
application; production env needs `NEXT_PUBLIC_MARKETPLACE_HOST`,
`STRIPE_MARKET_WEBHOOK_SECRET`, `PLATFORM_ADMIN_EMAILS`, the Stripe
marketplace webhook endpoint, and the `rent` subdomain in Vercel.
Remaining backlog (deferred by design): marketplace-only seller signup
(12% tier), private-bucket evidence storage, world #2 graduation
tooling, trust-queue expansion beyond disputes.
**Launch scope assumed**: `hosting-and-events` live in 1–2 metros, other 6 worlds in smoke-test mode (spec §31).

---

## 0. The isolation principle (read this first)

The governing constraint for every decision below: **a bug or outage in the operator app must not take down the marketplace, and vice versa.**

The codebase audit (section 1) shows the operator SaaS and the marketplace would share one repo, one database, and (initially) one deployment. Shared things are shared failure domains. This plan manages that with four hard rules:

**Rule 1 — Share primitives, never flows.**
Marketplace code may import *pure, stateless* shared modules (money math, datetime, capability-registry pattern, i18n, Supabase clients, observability). It may NEVER import operator *feature* modules: `lib/orders/`, `lib/routes/`, `lib/checkout/`, `lib/data/` (dashboard queries), `lib/crew/`, any `app/dashboard/*` action. Operator flows change weekly; their bugs must not propagate. Enforced mechanically — see Rule 4.

**Rule 2 — Separate Postgres schema, ID-only references.**
All marketplace tables live in a dedicated `market` schema (`market.listings`, `market.bookings`, `market.conversations`, …). Marketplace tables may FK to *stable identity* tables only (`organizations`, `profiles`, `products`, `assets`) — never to operator *flow* tables (`orders`, `routes`, `route_stops`, `payments`). Operator migrations cannot accidentally break marketplace tables and RLS stays independently auditable per schema.

**Rule 3 — The event bridge is the only crossing, and it is asynchronous.**
A confirmed marketplace booking does NOT call operator code or insert operator rows inline. It writes a row to `market.outbox`; a separate consumer creates the operator fulfillment projection (spec §27). Consequences:
- Operator app broken/down → marketplace bookings still complete; projections catch up when the consumer recovers.
- Marketplace broken/down → operator dashboards, routes, SaaS billing entirely unaffected.
- The bridge contract (event names + payloads, spec §27) is versioned; either side can change internals freely.

**Rule 4 — Make the boundary mechanical, not aspirational.**
- ESLint `no-restricted-imports` rule: files under `lib/market/**` and `app/market/**` may not import from the operator feature paths listed in Rule 1 (and vice versa). CI fails on violation.
- Separate test suites: `tests/market/**` and existing tests both run when `lib/` shared primitives change; only the affected suite runs otherwise (extend the existing "Detect changes" CI job).
- Separate cron routes (`/api/cron/market-*`) and a separate Stripe webhook endpoint (`/api/market/stripe/webhooks`) so a failing operator cron or webhook never blocks marketplace processing.

**The honest residual risk**: one Next.js deployment means a build-breaking deploy or platform outage affects both surfaces. That is acceptable at launch (docs-only and operator deploys already gate on TypeScript + tests), and Rules 1–4 are exactly what makes the later fix cheap: when traffic justifies it, `app/market/` + `lib/market/` extract into a second Vercel project (or `apps/` workspace) with near-zero refactoring, because nothing in them references operator internals. **Decision: no monorepo migration now.** The spec §1's `apps/packages` layout is the *eventual* shape; bounded modules inside the existing app are the launch shape. Migrating ~125 migrations and every import path to workspaces before having a single marketplace booking is risk with no user-facing payoff.

---

## 1. Repo audit — what exists today (verified June 2026)

| Area | State | Key pointers |
|---|---|---|
| Tenancy | Subdomain + custom-domain storefronts resolved in edge middleware via `x-tenant-host`; org lookup bypasses RLS for routing | `middleware.ts:24-51`, `lib/auth/resolve-org.ts:119-141` |
| Accounts | **Operator auth only.** Customers are CRM rows, not users; portal is token/magic-link based (90-day expiry) | `lib/portal/access-token.ts`, `customers` table |
| Availability | Production-grade: `reserve_availability_if_available()` RPC with `pg_advisory_xact_lock`, 30-min checkout holds, 15-min cleanup cron; capacity = count of ready assets | `lib/availability/blocks.ts`, migration `20260514_020000`, `/api/cron/cleanup-holds` |
| Payments | Stripe only, no Connect. Deposit checkout + SaaS subscriptions. Webhook idempotency state machine (`claimed/succeeded/failed`, 5 attempts) | `lib/stripe/webhook-ledger.ts`, `stripe_webhook_events`, migration `20260607_010000` |
| Messaging | Operator→customer email/SMS/WhatsApp dispatch with fallback tree; in-app `messages` table is per-order, operator-initiated; **no peer-to-peer system** | `lib/messaging/dispatch.ts`, `lib/messages/actions.ts` |
| Verticals/capabilities | Config-driven registries: 6 verticals, 13 stateless capabilities bound via `products.capability_slugs` + `categories.default_capability_slugs`, boot-time validation | `lib/verticals/registry.ts`, `lib/capabilities/registry.ts` |
| RLS/security | `get_user_org_ids()` + `user_has_org_role()` policy helpers; privileged writes via SECURITY DEFINER RPCs; payments table read-only to clients; anti-self-escalation trigger on memberships | migrations `20260606_*`, `20260325_010000` |
| Evidence | Delivery + pickup photo/signature via TOCTOU-safe crew RPCs; rendered in operator + portal views | `crew_attach_proof_photo()`, `crew_attach_pickup_photo()`, migration `20260604_010000` |
| Pricing | Deterministic, cents-based: flat-day/per-day/per-hour/per-unit + variants, add-ons, rules engine with priority ordering | `lib/pricing/engine.ts`, `lib/capabilities/pricing/*` |
| Deployment | Single Next.js 16 app, no workspaces, 9 Vercel crons, Sentry, Playwright + node test suites | `vercel.json`, `package.json` |

---

## 2. Reuse map

### Reuse as-is (shared primitives — Rule 1 safe)
- Money/cents math, `lib/datetime`, i18n, Sentry observability, rate-limit infra
- Supabase client factories + admin-client pattern
- RLS helper functions (`get_user_org_ids`, `user_has_org_role`) — extend with marketplace-role variants
- Edge middleware tenant resolution — extended with one new host: the marketplace domain
- Email/SMS/WhatsApp **dispatch infrastructure** (providers, templates, retry outbox) — marketplace adds its own templates, reuses the pipes
- Capability-registry *pattern* (`lib/capabilities/registry.ts`) — the policy registry (spec §5–6) is the same pattern with worlds/categories/risk-families as the config axis

### Reuse the pattern, build a new instance (copy, don't couple)
- **Reservation holds**: model on `reserve_availability_if_available()` (advisory lock, expiry, cleanup cron) but the marketplace needs the richer §10 state machine (TTL ladder, standby queue) → new `market.reservation_holds` + new RPC, 5-min `market-cleanup-holds` cron
- **Webhook idempotency ledger**: copy the `stripe_webhook_events` state machine for a separate `market.stripe_connect_events` table behind the separate Connect webhook endpoint
- **Evidence RPCs**: crew proof-photo RPC pattern → `market.handoff_evidence` with renter+seller submission paths (spec §16)
- **Pricing engine shape**: deterministic, cents-based, priority-ordered rules → marketplace pricing/deposit engines follow the same construction

### Extend (the two real schema-level changes to shared tables)
- **Renter auth**: today only operators have accounts. Marketplace renters become Supabase Auth users with `profiles` rows and **no org membership** — verification state lives in `market.user_verification`. This is the largest accounts-model change in the plan.
- **Seller = organization**: marketplace-only sellers are lightweight `organizations` rows (spec §22 already calls for this). Store-page identity (name, slug, badges, response metrics) lives in `market.seller_profiles` keyed by org id — no changes to operator org columns. Per spec §22, marketplace sellers get a store *page* on the marketplace domain (`/store/{slug}`), never a subdomain or website — the SaaS white-label storefront product is a separate surface and is untouched.

### Build new (no operator counterpart exists)
Listings + publication workflow, booking state machine (§13), Stripe **Connect** onboarding/payouts/ledgers (§15), deposit engine (§9), reviews, search/ranking (§21), marketplace conversations + moderation (§18, §20, §26 — the existing `messages` table is the wrong shape and stays untouched), disputes/claims (§17), verification workflows (§12, provider TBD), benchmarks (§11, curated-manual at launch), bridge outbox/inbox (§27), admin/trust surfaces, smoke-test world pages + waitlist + demand logging (§31).

### Known gaps the audit surfaced (beyond "build new")
- Availability supports serialized-by-count only; §7's quantity-based and bundle modes need new reservation logic (quantity ledger per slot; bundles reserve components transactionally)
- `lib/media/` has no real upload layer — marketplace evidence/listing photos need a proper Supabase Storage upload module (operator side stores bare URLs)
- No reviews, no cross-org search, no commission schema anywhere — all greenfield as expected

---

## 3. Build order (re-cut from spec §28 against the §31 launch scope)

Each sprint ends with a gate; don't start the next until it passes or is explicitly waived.

**M0 — Boundary + foundations (week 1-2)**
`market` Postgres schema; ESLint import-boundary rule + CI wiring; marketplace host routing in middleware; policy registry (7 worlds, full category tree, risk families, §6 operating-matrix defaults as config); restricted-items seed list (§25); renter auth (signup/login, email+phone verification).
*Gate: registry boot-validates like the verticals registry; a renter can create an account; lint rule fails a deliberate cross-boundary import.*

**M1 — Supply + demand sensing (week 3-5)**
Seller store pages (`market.seller_profiles`, served at `/store/{slug}` on the marketplace domain — not subdomains); Seller Hub v1 (spec §32): listings manager + Connect onboarding status at `/selling/*`; listing model + draft→pending→published workflow with moderation flag; Korent-operator "list on marketplace" path reading from their existing `products` (ID reference only); **all 7 worlds browsable** — hosting-and-events bookable later, other 6 in smoke-test mode with search logging, waitlists, draft pre-listings (§31).
*Gate: a seller can publish a listing in hosting-and-events; smoke-test worlds record searches + waitlist joins; demand dashboard query works.*

**M2 — Reservations + booking (week 6-8)**
§10 hold state machine + standby queue + 5-min cleanup cron; §13 booking state machine; §14 turnaround buffers; Seller Hub: requests approve/decline with 24h SLA countdown + calendar/blackouts (§32); serialized + quantity inventory modes (bundles deferred unless a launch seller needs them).
*Gate: two concurrent checkouts on the last unit — one holds, one lands in standby; expiry promotes standby; buffers block adjacent bookings.*

**M3 — Money (week 9-11)**
Stripe Connect Express onboarding for sellers; booking payment + platform fee (12%/8%, $4 min); deposit engine (§9) — `captured_refundable` strategy first, auth-holds added once handoff timing data exists; booking + settlement ledgers; Seller Hub: earnings & payouts view (§32); separate Connect webhook endpoint with its own idempotency ledger; payout release on completion.
*Gate: end-to-end sandbox booking — renter pays, fee split correct in ledger, deposit captured and refunded on clean return, seller payout releases.*

**M4 — Trust during the rental (week 12-14)**
Pickup/return evidence (§16); marketplace conversations with phase model + hard-block/soft-warn moderation rules (§18, §20, §26) including the Seller Hub inbox (§32); §24 notification matrix on existing dispatch infra; ID verification before first booking (provider choice is a flagged decision — spec §30).
*Gate: full lifecycle with evidence at both ends; a message containing a phone number pre-booking is blocked and logged.*

**M5 — When things go wrong (week 15-17)**
Disputes/claims (§17) with evidence linkage and deposit allocation; admin/trust queues (§19) — start with disputes + listing moderation, fold the other queues in as volume appears; reviews (gated on completed bookings); chargeback case model (§15).
*Gate: a dispute resolves with partial deposit allocation; admin can freeze a payout.*

**M6 — Bridge + ranking, then launch (week 18-20)**
Outbox/inbox bridge + operator fulfillment projection (§27) for Korent-operator sellers; ranking v1 (availability, distance, completeness, response metrics — §21) with the Seller Hub performance panel exposing the same metrics to sellers (§32); launch-readiness pass against §31 gates in the 1–2 launch metros.
*Gate: marketplace booking by an operator-seller produces a fulfillment projection without any synchronous operator call; killing the consumer delays but never loses projections (idempotent replay).*

**Deferred post-launch**: benchmark ingestion pipeline (§11 — launch on curated manual inputs), auto-pricing, bundle inventory mode (unless needed in M2), additional trust queues, world #2 graduation (§31 gates decide).

---

## 4. Decisions made by this plan (flag here if you disagree)

1. **No monorepo migration before launch** — bounded modules + `market` schema + import-boundary lint, with the §1 apps/packages layout as the post-traction extraction path (§0).
2. **Renters get real auth accounts**; the operator-side token portal stays untouched for SaaS customers.
3. **Marketplace-only sellers are lightweight organizations**, not a new entity type.
4. **`captured_refundable` deposits before auth-holds** — simpler, and §9's 96-hour rule needs real handoff-timing data to apply safely.
5. **Stripe Connect Express** (hosted onboarding) over Custom — solo-founder operationally realistic.

## 5. Unresolved (inherited from spec §30 — do not fake)

KYC/ID provider; launch jurisdictions + marketplace-facilitator tax; restricted-items legal review by geography; launch metros (needed by M1 for smoke-test geo dimensions); benchmark seed coverage; support staffing; insurance answer for any future trailers-and-hauling go-live.
