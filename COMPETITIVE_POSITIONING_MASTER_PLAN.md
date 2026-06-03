# Korent — Competitive Positioning Master Plan

## Purpose

This document is the **execution checklist** for the strategy laid out in [`docs/strategy/`](docs/strategy/README.md).

The strategy in one sentence:

> **Displace Goodshuffle Pro for US tier-2/3 party rental operators by shipping the features they're missing (SMS, portal, WhatsApp, QuickBooks, route optimization) at half the realistic price, then expand into US Hispanic markets and Mexico in months 6-12.**

The research that justifies this plan lives in:
- [`docs/strategy/01-market-analysis.md`](docs/strategy/01-market-analysis.md) — market sizing
- [`docs/strategy/02-competitive-analysis.md`](docs/strategy/02-competitive-analysis.md) — feature matrix
- [`docs/strategy/03-payments-and-pricing.md`](docs/strategy/03-payments-and-pricing.md) — pricing & Stripe Mexico
- [`docs/strategy/04-gtm-and-positioning.md`](docs/strategy/04-gtm-and-positioning.md) — GTM channels & SEO calendar

---

## How to use this document

- **Checkboxes** track work. Tick `[x]` when done; leave `[ ]` when pending.
- **Each phase has a clear gate** at the end. Don't move to the next phase until the gate is met or explicitly waived in the decisions log.
- **Owner column** is left blank until assigned. Self-assign as work begins.
- **When evidence changes a decision**, update the relevant research doc AND the decisions log in [`docs/strategy/README.md`](docs/strategy/README.md).

---

## Phase 0 — Foundation (weeks 0-1) — committed

Decisions that frame everything else. **Done** before any sprint starts.

- [x] Decided primary target: **Goodshuffle Pro**
- [x] Decided primary vertical: **party/event rental**
- [x] Decided primary geography: **US tier-2/3 cities**
- [x] Decided Mexico is secondary, not primary
- [x] Decided pricing: Starter $49 / Pro $99 / Growth $199
- [x] Decided Mexico payment processor: **Stripe Mexico** (Conekta as fallback)
- [x] Decided WhatsApp Business API is the highest-leverage net-new feature
- [x] Research documented in `docs/strategy/`

---

## Phase 1 — Gap closure: P0 features (weeks 1-8)

Goal: close the gaps that make a credible head-to-head comparison page against Goodshuffle Pro impossible to publish today.

### Sprint 1 — Pull sheets / loading lists + QBO CSV export (week 1-2)

The smallest credible-gap close. Trivial from existing route + order data. Also includes a 1-day QBO CSV export quick-win to remove the immediate "do you sync with QuickBooks?" sales objection before the full integration ships in Sprint 2.

**Pull sheets:**
- [x] Audit existing `routes` and `route_stops` tables for required fields
- [x] Build `lib/logistics/pull-sheet.ts` — given a route, return ordered list of items to load
- [x] Add `app/dashboard/deliveries/[routeId]/pull-sheet` page (printable view)
- [x] PDF export via existing jsPDF infra (`lib/invoices/generate-pdf.ts` pattern) — `lib/logistics/generate-pull-sheet-pdf.ts` + `app/api/deliveries/[id]/pull-sheet/route.ts`
- [x] Add "Print pull sheet" button on the delivery board kanban card AND route detail page
- [x] Playwright smoke test: `tests/smoke/pull-sheet.spec.ts`
- [x] Help Center article: `pull-sheets` slug in `lib/help/articles.ts`

**QBO CSV export (quick-win):**
- [x] Build `lib/integrations/quickbooks/csv-export.ts` — format invoices for QBO import
- [x] Add "Export for QuickBooks" button on `app/dashboard/payments/page.tsx`
- [x] Match Intuit's expected import schema (InvoiceNo, Customer, InvoiceDate, DueDate, Item, ItemQuantity, ItemRate, ItemAmount, Memo)
- [x] Documentation in `docs/integrations/quickbooks-csv.md` explaining the workflow to accountants
- [x] Unit test for CSV escape logic: `tests/quickbooks-csv-format.test.ts` (7 tests, all passing)
- [x] New `quickbooks_export` feature gate (Pro+) — `lib/stripe/gate.ts`
- [ ] **Gate**: pull sheet + QBO CSV export both work end-to-end on staging (pending Vercel preview verification)

**Deferred follow-ups** (small enhancements, not blocking):
- [ ] Date-range picker on QBO export for quarterly bookkeeping workflows
- [ ] Pull sheet PDF: support for pickup-stop section (currently delivery-only)
- [ ] In-app Help Center article for the QBO CSV export workflow (currently dev-facing docs only)

### Sprint 1.5 — Smart Delivery Mode (weeks 3-4)

**Goal**: collapse the 3-click "create route → add stop → start delivery" ritual into a 1-click "Send delivery" per order for the ~80-90% of operators who are noobs or time-poor SMB owners. Preserve manual route control for the minority of power users via a Settings → Advanced toggle.

**Background**: a recon of the existing delivery flow surfaced that a brand-new operator with 1 confirmed order today must (a) create a route, (b) navigate into that route, (c) add the order as a stop, (d) click Start Route — and the route abstraction is jargon they've never met before. The existing auto-attach (`lib/routes/auto-attach.ts`) silently fails when no route exists yet, which is the most common starting state.

Market evidence: 80-90% of US/Mexico party rental operators are not on any rental SaaS today (see [`docs/strategy/01-market-analysis.md`](docs/strategy/01-market-analysis.md) and [`02-competitive-analysis.md`](docs/strategy/02-competitive-analysis.md)). The median Korent buyer has never used the word "route" professionally. The "route" abstraction is load-bearing for multi-stop dispatch but dead weight for single-order days. The strategic decision to ship Option C (route invisible by default + Settings toggle for power users) is recorded in [`docs/strategy/README.md`](docs/strategy/README.md).

#### Data model

- [x] Add `organizations.routing_mode text not null default 'auto'` with check constraint `in ('auto', 'manual')` — `supabase/migrations/20260603_010000_smart_delivery_mode.sql`
- [x] Migration default for existing orgs: pre-flip to `'manual'` if the org has any existing routes (preserves their workflow); otherwise leave at `'auto'`
- [x] Legacy `settings.auto_route_on_confirm = false` also pinned to `'manual'` as a safety net
- [x] No schema change to `routes` or `route_stops` — the logic change is purely in actions + cleanup
- [x] One-time zombie cleanup migration: past-dated `planned` routes with zero stops deleted on deploy

#### Auto-create + auto-bundle (the core change)

- [x] Extended `lib/routes/auto-attach.ts`: handles the "no route exists" branch by creating `"Deliveries for {formatted date}"` and attaching
- [x] 2nd, Nth same-date order auto-bundles into the existing route
- [x] Auto-sequence stops by `event_start_time` (timestamptz, already tz-corrected) on every insert via a safe two-pass renumber that respects the `(route_id, stop_sequence)` unique index
- [x] Manual mode: existing behavior preserved (auto-attach bails on `no_route`)
- [x] `AutoAttachResult` now carries `created: boolean` so the order action can render "Auto-scheduled on …" vs "Added to route …" appropriately

#### Per-order "Send delivery" button

- [x] `components/orders/send-delivery-button.tsx` — visible when order is `confirmed` or `scheduled`
- [x] Mounted on `app/dashboard/orders/[id]/page.tsx` next to ConfirmOrderButton
- [x] Atomic RPC `dispatch_order_delivery` in `supabase/migrations/20260603_020000_dispatch_order_delivery_rpc.sql`:
  - Stop → `en_route`
  - Route → `in_progress` (idempotent)
  - Order → `out_for_delivery`
- [x] `lib/routes/dispatch.ts` wraps the RPC with friendly error messages per documented `reason`
- [x] Customer "delivery on the way" SMS fires from both the new path and the legacy `updateStopStatus` path via shared helper `lib/routes/send-en-route-sms.ts` (closes a gap where the new button would have silently skipped the customer notification)
- [ ] **Deferred to follow-up**: render "Auto-scheduled on Deliveries for {date} (stop #N of M)" context line on the order detail page (the data is there but not yet surfaced)

#### Cleanup rules (kill the zombies)

- [x] `removeStopFromRoute` (lib/routes/actions.ts): last-stop removal on a `planned` route always deletes the route — broadened from "only if the route never had stops"
- [x] `removeOrderStopOnCancel` in `lib/routes/remove-stop-on-cancel.ts`: when an order moves to `cancelled`, its stop is auto-removed, sequencing closed, and the route deleted if it was the last stop. Wired into `updateOrderStatus`. Applies in both auto AND manual mode.
- [x] `refunded` intentionally NOT in the chain — refunds happen on already-delivered orders; tearing down a stop mid-delivery would confuse the crew. Documented in `docs/architecture/smart-delivery-mode.md`.

#### Empty-state UX

- [x] `/dashboard/deliveries` in auto mode: new top panel explains "Korent will auto-schedule"; manual-mode link in the footer
- [x] Manual mode preserves the existing "Create a Route" form
- [x] Settings → Smart Delivery Mode section with a one-click toggle (`components/settings/routing-mode-form.tsx`) — Pro+ copy explains auto vs manual

#### Terminology change for single-stop routes

- [ ] **Deferred**: kanban cards still show "Route" jargon. The auto-mode top panel reframes the page narrative; per-card label change is a small follow-up.

#### Crew mobile

- [x] Crew mobile path is unchanged at the data layer; works with auto-routes (routes look the same whether created by a human or by `auto-attach`). Smoke verified via build + typecheck.
- [ ] **Deferred**: copy update on the "No routes for today" empty state.

#### Tests

- [x] `tests/auto-attach-create.test.ts` — 7 unit tests covering auto-create, auto-bundle, manual-mode bail, legacy kill-switch, no-event-date, no-address, ambiguous-routes
- [x] All 20 unit tests pass (`compute-financials`, `portal-access-token`, `quickbooks-csv-format`, `rate-limit-policy`, `auto-attach-create`)
- [ ] **Deferred**: Playwright walkthrough (signup → confirm → Send delivery → out_for_delivery); SQL test for the zombie cleanup migration. Both add coverage without changing behavior; they can land in a small follow-up.

#### Documentation

- [x] New Help Center article `smart-delivery-mode` in `lib/help/articles.ts`
- [x] `docs/architecture/smart-delivery-mode.md` covering the algorithm, the two-pass re-sequence, the dispatch RPC contract, the cancellation chain, and the explicit non-goals
- [ ] **Deferred**: refresh of the existing `delivery-routes` and `crew-mobile` Help Center articles to mention manual mode is now an opt-in

#### Migration & rollout

- [x] Two migrations: `20260603_010000_smart_delivery_mode.sql` + `20260603_020000_dispatch_order_delivery_rpc.sql`
- [x] No feature flag. Auto is the default for new orgs; existing orgs with routes pre-flip to manual.
- [x] i18n strings added to en/es/fr/pt for the auto-mode panel + Settings toggle + Send delivery button

#### Gate

- [x] TypeScript clean
- [x] Production build clean
- [x] All 20 unit tests pass
- [ ] Manual smoke on Vercel preview: signup → create order → confirm → see auto-attach message → click Send delivery → order is `out_for_delivery`
- [ ] Manual smoke: cancel an order with a stop → verify route is cleaned up if last stop
- [ ] Manual smoke: Settings → switch to manual → verify deliveries dashboard reverts to "Create a Route" form

### Sprint 2 — QuickBooks Online integration (weeks 5-6)

The single biggest deal-blocker vs Goodshuffle. Even one-way sync (Korent → QBO invoices and payments) closes the practical use case.

**External (founder, parallel to engineering):**
- [ ] Register Intuit developer account + OAuth app (sandbox)
- [ ] Configure OAuth redirect URI in Intuit dev portal to match `QBO_REDIRECT_URI`
- [ ] Set `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, `QBO_ENVIRONMENT` env vars in Vercel
- [ ] Apply for Intuit certification (production scope, 4-8 weeks Intuit review)

**Engineering:**
- [x] `lib/integrations/quickbooks/client.ts` — OAuth + Accounting API client with auto-refresh on 401
- [x] Database: `organizations.qbo_realm_id` + token columns + `quickbooks_invoice_sync` table with RLS — `supabase/migrations/20260603_040000_quickbooks_online_connection.sql`
- [x] Connect / disconnect / callback routes in `app/api/integrations/quickbooks/*`
- [x] Settings → Integrations card (`components/settings/quickbooks-card.tsx`)
- [x] Auto-sync paid invoices on `delivered` (fire-and-forget hook in `updateOrderStatus`)
- [x] Manual "Sync to QuickBooks" button on order page for first-time testing + recovery
- [x] Sync customers → QBO Customer on first invoice (find-or-create by display name)
- [x] Daily reconciliation cron `/api/cron/quickbooks-reconcile` — retries failed/missing syncs (1h cool-off, cap 100/org/run)
- [x] Help Center article + architecture doc
- [x] 7 unit tests (URL building, token refresh, 401 retry, 429, network errors)
- [x] Playwright HTTP smoke for route auth gating + cron secret

**Deferred to Sprint 2.5** (documented in `docs/architecture/quickbooks-online-sync.md`):
- [ ] Token-at-rest encryption via Supabase Vault
- [ ] QBO → Korent webhook listener (customer-merged, account-deleted)
- [ ] Map Korent products → QBO Items
- [ ] Payment record push
- [ ] Refund / void handling
- [ ] Batch operations for high-volume orgs

**Gate:**
- [ ] Operator wires `QBO_CLIENT_ID` / `QBO_CLIENT_SECRET` to a sandbox app
- [ ] 1 internal test org has 10+ successfully synced invoices (manual smoke after env wiring)
- [ ] Intuit certification submitted

### Sprint 3 — Recurring bookings UI (weeks 7-8)

Schema for recurring patterns did NOT actually exist (the Sprint 1 recon was wrong); designed and shipped fresh. Unlocks tent/equipment monthly rentals (Booqable explicit weakness) and repeat-event party rentals.

- [x] Designed schema: `order_series` table + `orders.order_series_id` + `series_occurrence_number` — `supabase/migrations/20260603_050000_recurring_order_series.sql`
- [x] Build "Make recurring" form on the order detail page (`components/orders/make-recurring-form.tsx`)
- [x] UI for cadence: daily / weekly / biweekly / monthly / quarterly with multiplier (1-52)
- [x] End-date OR max-occurrences termination (operator picks)
- [x] Pure cadence math module (`lib/orders/series-cadence.ts`) with month-end clamp, year rollover, leap-year handling
- [x] Server action `createSeriesFromOrder` generates child orders eagerly (~2 year horizon, 104-batch cap)
- [x] Daily expansion cron `/api/cron/expand-recurring-series` rolls the horizon forward for indefinite series
- [x] Cancel-series action with "also cancel future bookings" checkbox (past orders always preserved)
- [x] Pause / resume series controls
- [x] SeriesInfoCard on child order pages showing cadence summary + controls
- [x] 17 unit tests for the cadence math (every edge: month-end clamp, leap year, end_date inclusive, max_occurrences, batch cap, alreadyGeneratedThrough cursor, misconfigured ranges)
- [x] Playwright smoke for cron auth + order page render regression
- [x] Help Center article (`recurring-bookings`) + architecture doc (`docs/architecture/recurring-bookings.md`)

**Deferred to Sprint 3.5** (documented in architecture doc):
- [ ] Calendar view badge showing "part of series"
- [ ] Email/SMS template adjustment to mention "occurrence N of M"
- [ ] Edit cadence after creation (today: cancel + recreate)
- [ ] Regenerate-future-occurrences after editing template items
- [ ] Variable per-occurrence pricing (price escalator for long-running rentals)
- [ ] Live-Supabase end-to-end Playwright walk (today covered by 17 cadence unit tests + auth smoke)

**Gate:**
- [ ] Tested with internal demo org (manual smoke once migrations are applied to the preview Supabase)

### Phase 1 gate

- [ ] Pull sheets shipped
- [ ] QuickBooks Online shipped (sandbox-certified, production-pending)
- [ ] Recurring bookings shipped
- [ ] Head-to-head Goodshuffle comparison page can be published honestly

---

## Phase 2 — Differentiation: P1 features (weeks 9-14)

Goal: ship the wedge features nobody else has, so the positioning isn't just "cheaper" but "actually better for specific workflows."

### Sprint 3.5 — Xero integration (week 9, 3-4 days)

Same shape of integration code as QBO. Goodshuffle doesn't have Xero, only Booqable does (in beta). Instantly leapfrogs Goodshuffle on a feature their customers explicitly request — particularly newer/younger operators who chose Xero over QuickBooks.

**External (founder):**
- [ ] Register Xero developer account at developer.xero.com
- [ ] Create app, get OAuth credentials
- [ ] Set env vars: `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`

**Engineering:**
- [x] `lib/integrations/xero/client.ts` — OAuth (PKCE) + Accounting API client with auto-refresh on 401 + tenant header
- [x] Database: `organizations.xero_*` columns + `xero_invoice_sync` table with RLS — `supabase/migrations/20260603_060000_xero_connection.sql`
- [x] One-way sync: paid invoices → Xero Contact + Invoice (ACCREC, AUTHORISED) — `lib/integrations/xero/sync.ts`
- [x] Contact find-or-create by display name (mirrors QBO pattern)
- [x] Connect / callback / disconnect routes (owner/admin, PKCE + state cookies)
- [x] Settings → Integrations card sits next to the QBO card with its own banner
- [x] Manual "Sync to Xero" button on the order page
- [x] Auto-sync on `delivered` fires both QBO and Xero in parallel
- [x] Daily reconcile cron `/api/cron/xero-reconcile` at 06:30 UTC
- [x] 7 unit tests (PKCE pair, authorize URL, token refresh with tenant preservation, tenant header on API, 401 retry, 429, network)
- [x] Playwright HTTP smoke for auth gating + cron secret
- [x] Architecture doc (`docs/architecture/xero-sync.md`) + Help Center article (`xero-sync`)

**Deferred to Sprint 3.7:**
- [ ] Multi-tenant chooser UI
- [ ] Token-at-rest Vault encryption (shared with QBO migration)
- [ ] Xero webhook listener
- [ ] Account-code mapping
- [ ] Payment record push

**Gate:**
- [ ] Operator wires `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` to a sandbox app
- [ ] 1 internal test org has 5+ successfully synced Xero invoices (manual smoke after env wiring)

### Sprint 4 — WhatsApp Business API (weeks 9-11)

**The single highest-leverage net-new feature.** None of the three competitors ship WhatsApp natively. Reuses existing Twilio abstraction.

**External (founder/operator):**
- [ ] Twilio Console — enable WhatsApp on the account, get sandbox sender
- [ ] Submit 5 templates for Meta approval (bodies in `lib/messaging/whatsapp-templates.ts`)
- [ ] Apply for production WhatsApp Business sender approval
- [ ] Add `WHATSAPP_TEMPLATE_*` env vars to Vercel once Twilio surfaces Content SIDs

**Engineering:**
- [x] New `lib/messaging/` module — `whatsapp-provider.ts` (Twilio WhatsApp send), `whatsapp-templates.ts` (ContentSid registry + positional variables), `dispatch.ts` (WhatsApp → SMS decision tree)
- [x] Schema: `customers.whatsapp_opted_in`, `customers.whatsapp_number`, `organizations.whatsapp_enabled`, `organizations.whatsapp_sender_id` — `supabase/migrations/20260603_070000_whatsapp_business.sql`
- [x] Communication log channel widened to include `whatsapp` — `supabase/migrations/20260603_080000_communication_log_whatsapp.sql`
- [x] Existing `sendSmsNotification` threads through the dispatcher; falls back automatically when WhatsApp preconditions fail
- [x] Operator toggle in Settings → SMS Notifications → WhatsApp section (`components/settings/whatsapp-settings-form.tsx`)
- [x] Per-channel logging — comm log records which channel actually delivered
- [x] 6 unit tests pinning the full decision tree (`tests/whatsapp-dispatch.test.ts`)
- [x] Architecture doc + Help Center article (`whatsapp-notifications`)
- [x] `.env.example` documents 7 template Content SID env vars

**Deferred to Sprint 4.5** (documented in architecture doc):
- [ ] Customer-facing opt-in flow (currently operator-toggled per customer)
- [ ] In-app WhatsApp inbound message thread view
- [ ] Per-template approval status surface on Settings
- [ ] Multi-sender per org
- [ ] WhatsApp-native rich content (images, location, interactive buttons)

**Gate:**
- [ ] Operator wires `TWILIO_*` env vars (already done if SMS works) + `WHATSAPP_TEMPLATE_*` SIDs
- [ ] 1 internal test customer opts in, receives a WhatsApp deposit reminder, sees it in the comm log with the WhatsApp badge

### Sprint 5 — Route auto-optimization (weeks 12-14)

Closes the last functional gap vs Goodshuffle and InflatableOffice (both have one-click solvers).

- [ ] Pick provider: Google Routes API (better for US, ~$5 per 1k stops) vs Mapbox Optimization (cheaper, OSS-friendly)
- [ ] Build `lib/logistics/route-optimizer.ts` — given a list of stops, return optimized order
- [ ] "Optimize route" button on `app/dashboard/deliveries/[routeId]` page
- [ ] Cost preview (estimated drive time + distance) before applying
- [ ] Cache optimization results per route (don't re-charge on view)
- [ ] Handle locked stops (driver already departed → don't reorder en-route stops)
- [ ] Optional: auto-calculate gas cost (from distance × fuel price) and labor cost (from time × driver wage)
- [ ] Playwright test: 5-stop route → click optimize → order changes per algorithm
- [ ] **Gate**: time savings demoable to 3 beta customers

### Phase 2 gate

- [ ] WhatsApp shipped (Meta approval done)
- [ ] Route optimization shipped
- [ ] All 4 P0+P1 sprints landed in production

---

## Phase 3 — GTM: US tier-2/3 launch (weeks 1-12, parallel with Phase 1+2)

Sales and content motion runs in parallel with engineering — don't wait for all features to ship.

### Content (weeks 1-12, ongoing)

Publish 2 articles/week (Tue/Thu). Front-load 6 money pages in weeks 1-3.

**Weeks 1-3 — Money pages (priority)**
- [ ] Article 1: Goodshuffle Pro Alternatives: 7 Cheaper Options for Solo Operators (2026)
- [ ] Article 2: Bounce House Pricing Calculator (with embedded interactive widget)
- [ ] Article 3: Free Party Rental Contract Template (PDF + Editable, gated lead magnet)
- [ ] Article 4: Best Software for Bounce House Business Under $100/Month
- [ ] Article 5: InflatableOffice vs Goodshuffle vs Korent: Honest 2026 Comparison
- [ ] Article 6: How to Start a Bounce House Business in 2026: $15K Startup Plan

**Weeks 4-12 — Authority + retention**
- [ ] Articles 7-30 per calendar in [`docs/strategy/04-gtm-and-positioning.md`](docs/strategy/04-gtm-and-positioning.md#articles-7-30)
- [ ] Spanish duplicates of articles #6 and #3 (#23 and #24)

### Distribution (weeks 1-12, ongoing)

- [ ] Submit Korent to G2, Capterra, GetApp, SoftwareAdvice listings (take 4-6 weeks each)
- [ ] Join "Bounce House Business Owners" Facebook group, post helpful content weekly
- [ ] Join "Party Rental Business Owners" Facebook group
- [ ] Join "Event Rental Professionals" Facebook group
- [ ] Set up r/Entrepreneur, r/smallbusiness posting cadence (1/week)
- [ ] LinkedIn operator-voice carousel series (1/week)
- [ ] Weeks 4-6: cold outreach — 50 Apollo DMs/day with Loom demos to Tampa/Phoenix/Nashville/Austin operators
- [ ] Week 8: pitch guest posts to Magic Jump, Happy Jump, Tent and Table supplier blogs
- [ ] Week 12: HARO + 2-3 paid niche placements ($150-$400 each)

### Public landing pages

- [ ] Build `/compare/goodshuffle-pro` page with feature matrix
- [ ] Build `/compare/booqable` page
- [ ] Build `/compare/inflatableoffice` page
- [ ] Build `/pricing` updated with Starter $49 / Pro $99 / Growth $199
- [ ] Build `/migrate-from-goodshuffle` step-by-step guide
- [ ] Demo mode landing page emphasizing "Try without signup"

### Customer discovery (weeks 1-2)

Before scaling outbound, validate the pitch with real operators.

- [ ] Schedule 10 calls: 5 English-only, 5 Spanish-speaking US operators
- [ ] Validate: WhatsApp matters / doesn't matter
- [ ] Validate: sub-$99 vs $99 price-point sensitivity
- [ ] Validate: which Goodshuffle pain point lands hardest
- [ ] Document findings in [`docs/strategy/05-customer-discovery.md`](docs/strategy/) (new file)

### Phase 3 gate (Day 90)

- [ ] **15 paying US customers at ~$49 avg MRR = ~$735 MRR**
- [ ] 6 money pages ranking for at least 1 keyword each (Search Console impressions)
- [ ] Inbound demos ≥3/week from organic
- [ ] At least 1 Facebook group thread organically referencing Korent

---

## Phase 4 — Mexico beachhead (weeks 1-24, parallel)

Critical-path is the **Mexican entity setup**. Start it in week 1 even though it gates revenue.

### Entity setup (weeks 1-16)

- [ ] Week 1: Email Stripe Mexico sales — confirm onboarding requirements for a Mexican SA de CV owned by a US LLC
- [ ] Week 1: Email Conekta sales — same question (fallback path)
- [ ] Week 1: Engage Mexican lawyer for SA de CV incorporation (~$3-5k USD typical cost)
- [ ] Week 2: Engage Mexican accountant for RFC application + IVA registration prep
- [ ] Week 4: SA de CV incorporation papers filed
- [ ] Week 8: RFC obtained
- [ ] Week 10: CLABE Mexican bank account opened (BBVA / Citibanamex)
- [ ] Week 12: Stripe Mexico merchant application submitted
- [ ] Week 14-16: Stripe Mexico merchant approved
- [ ] Week 16: IVA registration filed under Digital Services Regime

### Code work (weeks 13-16, after entity is filed)

Begin once Stripe MX merchant is approved.

- [ ] Enable MXN currency option in `organizations.default_currency`
- [ ] Enable OXXO + SPEI payment methods in checkout flow (`lib/checkout/actions.ts`)
- [ ] Update Stripe webhook handler for OXXO async settlement (orders stay `pending_payment` for days)
- [ ] Spanish UI confirmation strings (i18n keys already exist — fill MXN-specific copy)
- [ ] Configure Stripe Tax MX for IVA collection
- [ ] Add MXN pricing tiers to landing page: Inicial $499 / Profesional $1,200 / Empresarial $2,400
- [ ] Playwright tests for OXXO async flow

### GTM Mexico (weeks 4-24)

- [ ] Week 4: Post job on Workana for bilingual SDR ($1,000/mo, part-time, Spanish-native)
- [ ] Week 5: Hire SDR, onboard with product walkthrough
- [ ] Week 6: SDR joins "RENTA Y VENTA DE MOBILIARIO PARA FIESTAS" Facebook group
- [ ] Week 6: Buy/share booth at Expo Tu Boda Monterrey Feb 21-22 ($1.5-2k)
- [ ] Week 8: SDR-led DM outreach to León/Bajío + Mérida operators (50 DMs/day)
- [ ] Week 12: Spanish-language landing page live
- [ ] Week 14: SDR starts wedding-planner Instagram outreach (referral kickback offered)
- [ ] Week 20: Begin Expo Tu Boda CDMX Aug 15-16 booth planning ($3-5k full booth)
- [ ] Week 22: Decision on Mexico paid acquisition (depends on Day-180 gate below)

### Day-180 gate

- [ ] ≥25 US customers
- [ ] Mexican entity registered (or in final approval)
- [ ] 3+ Mexican operators have signed up to waitlist or as customers
- [ ] **If yes**: flip switch on Mexico paid acquisition + double the SEO budget for Spanish content
- [ ] **If no**: stay US-only for next 90 days; pivot back to Mexico in Q4 with refined messaging

---

## Phase 5 — Vertical depth: bouncy castle / inflatable (months 4-6, conditional)

Conditional. Only execute if InflatableOffice churn signal is real (their reviews show "wants better UI" / "wants cheaper alternative") AND Korent has bandwidth.

- [ ] Damage waiver fee as native line item
- [ ] Sandbag / anchoring fee as native line item
- [ ] Max capacity fee as native line item
- [ ] Wet/dry dual-listing of the same physical inflatable
- [ ] Multi-unit obstacle course component tracking
- [ ] COI (Certificate of Insurance) generation module
- [ ] Auto gas + labor cost computation on optimized routes (already-have data, just need UI)

### Phase 5 gate

- [ ] Korent can demo head-to-head with InflatableOffice on every feature in their core niche
- [ ] At least 2 InflatableOffice churn customers signed to Korent

---

## Phase 6 — Public API + Zapier (month 6+, conditional)

Opens integration ecosystem. Goodshuffle doesn't have this. Booqable and IO do.

- [ ] Spec out REST API surface (start with read-only: orders, customers, inventory, payments)
- [ ] Build `app/api/public/v1/*` endpoints with API-key auth
- [ ] Rate limiting (reuse existing `supabase/migrations/20260326_020000_rate_limits.sql`)
- [ ] Build Zapier app (read + write trigger/action)
- [ ] Public docs site (start with Markdown + Next.js MDX)
- [ ] Webhook system for outbound events (`order.created`, `payment.succeeded`, etc.)
- [ ] Postman collection
- [ ] **Gate**: 5 Zapier flows verified in sandbox

---

## Phase 7 — Vertical expansion: car rental (months 9-12, conditional)

Existing [`CAR_RENTAL_EXPANSION_MASTER_PLAN_V2.md`](CAR_RENTAL_EXPANSION_MASTER_PLAN_V2.md) covers this. Defer until US party rental is on a $5k+ MRR baseline.

Reminder: car rental in Mexico has entrenched competition (HQ Rentals, RENTALL, Turo Commercial Host) and regulatory complexity (mandatory Mexican third-party insurance). Defer at least until a Mexican entity is operational.

---

## Cross-cutting: ongoing operational hygiene

These are not phase-bounded. Run continuously.

- [ ] Weekly: review Search Console for new keyword opportunities
- [ ] Weekly: triage Capterra / G2 review responses
- [ ] Bi-weekly: update [`docs/strategy/README.md`](docs/strategy/README.md) decisions log with anything that changed
- [ ] Monthly: refresh competitor pricing pages — Goodshuffle, Booqable, IO change quietly
- [ ] Monthly: refresh churn cohort numbers — adjust LTV assumptions
- [ ] Quarterly: revisit market sizing assumptions in [`01-market-analysis.md`](docs/strategy/01-market-analysis.md)

---

## Open questions parking lot

When evidence arrives, move these into a decision in [`docs/strategy/README.md`](docs/strategy/README.md).

- [ ] Will Stripe Mexico accept a US-LLC-owned Mexican SA de CV? (Week 1)
- [ ] Does Twilio WhatsApp BSP offer template-message support for transactional sends? (Week 7 spike)
- [ ] What % of US Hispanic party rental operators are in FL/TX/CA metros vs national spread? (Customer discovery)
- [ ] Is $499 MXN entry tier viable, or is Eventrix's $599 a price floor? (Mexico discovery calls)
- [ ] Should Phase 5 (inflatable depth) precede Phase 6 (public API)? (Reassess after Phase 2)

---

## Success metrics summary

| Phase | Gate | Metric |
|---|---|---|
| Phase 1 | Week 8 | 4 P0 features in production (pull sheets, QBO CSV, Smart Delivery Mode, QBO full sync, recurring bookings) |
| Phase 2 | Week 14 | WhatsApp + route optimization in production |
| Phase 3 | Day 90 | 15 US paying customers, ~$735 MRR |
| Phase 4 | Day 180 | 8+ Mexican paying customers OR pivot to US-only doubled budget |
| Phase 5 | Month 6 | 2 InflatableOffice churn customers (conditional) |
| Phase 6 | Month 6+ | 5 Zapier integrations verified (conditional) |
| Phase 7 | Month 9-12 | Car rental vertical deferred (see existing V2 plan) |

---

*Last updated: June 2026. Update the decisions log in [`docs/strategy/README.md`](docs/strategy/README.md) when major decisions change.*
