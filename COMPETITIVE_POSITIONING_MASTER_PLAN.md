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

## Phase 1 — Gap closure: P0 features (weeks 1-6)

Goal: close the gaps that make a credible head-to-head comparison page against Goodshuffle Pro impossible to publish today.

### Sprint 1 — Pull sheets / loading lists (week 1-2)

The smallest credible-gap close. Trivial from existing route + order data.

- [ ] Audit existing `routes` and `route_stops` tables for required fields
- [ ] Build `lib/logistics/pull-sheet.ts` — given a route, return ordered list of items to load
- [ ] Add `app/dashboard/deliveries/[routeId]/pull-sheet` page (printable view)
- [ ] PDF export via existing jsPDF infra (`lib/invoices/generate-pdf.ts` pattern)
- [ ] Add "Print pull sheet" button on the delivery board kanban card
- [ ] Playwright test: route → print pull sheet → PDF contains all items
- [ ] Update Help Center article on delivery workflow
- [ ] **Gate**: pull sheet feature works end-to-end on staging

### Sprint 2 — QuickBooks Online integration (weeks 3-4)

The single biggest deal-blocker vs Goodshuffle. Even one-way sync (Korent → QBO invoices and payments) closes the practical use case.

- [ ] Register Intuit developer account + OAuth app (sandbox)
- [ ] Build `lib/integrations/quickbooks/client.ts` — OAuth flow + token refresh
- [ ] Database: add `organizations.qbo_company_id`, `qbo_access_token`, `qbo_refresh_token` (encrypted)
- [ ] Connect / disconnect UI in `app/dashboard/settings/integrations/page.tsx`
- [ ] Sync paid invoices → QBO Invoice + Payment objects
- [ ] Sync customers → QBO Customer on first invoice
- [ ] Map Korent products → QBO Items (one-time setup per org)
- [ ] Webhook listener for QBO disconnects / token expiration
- [ ] Daily reconciliation cron — handle sync failures
- [ ] Playwright test: order paid → QBO invoice appears in sandbox
- [ ] Apply for Intuit certification (production scope)
- [ ] **Gate**: 1 internal test org has 10+ successfully synced invoices

### Sprint 3 — Recurring bookings UI (weeks 5-6)

Schema is already there. Build the UI to unlock tent/equipment monthly rentals (a Booqable explicit weakness).

- [ ] Read existing `recurring_pattern` schema in `supabase/migrations/...initial_schema.sql`
- [ ] Build "Make recurring" toggle in booking form
- [ ] UI for cadence: weekly / monthly / custom interval
- [ ] End-date or count-based termination
- [ ] Server action to generate child bookings (capped at 24 months out)
- [ ] Calendar view shows recurring instances with link to series
- [ ] Cancel-series action (with confirmation)
- [ ] Email/SMS templates respect recurring-instance context
- [ ] Playwright test: create monthly recurring booking → 12 instances appear on calendar
- [ ] **Gate**: tested with internal demo org

### Phase 1 gate

- [ ] Pull sheets shipped
- [ ] QuickBooks Online shipped (sandbox-certified, production-pending)
- [ ] Recurring bookings shipped
- [ ] Head-to-head Goodshuffle comparison page can be published honestly

---

## Phase 2 — Differentiation: P1 features (weeks 7-12)

Goal: ship the wedge features nobody else has, so the positioning isn't just "cheaper" but "actually better for specific workflows."

### Sprint 4 — WhatsApp Business API (weeks 7-9)

**The single highest-leverage net-new feature.** None of the three competitors ship WhatsApp natively. Reuses existing Twilio abstraction.

- [ ] Spike: verify Twilio WhatsApp BSP supports template + freeform messages required for transactional sends
- [ ] Apply for WhatsApp Business sender approval (Twilio handles the Meta application)
- [ ] Extend `lib/sms/provider.ts` → `lib/messaging/provider.ts` to abstract SMS + WhatsApp
- [ ] WhatsApp message templates (deposit reminder, day-before reminder, weather alert) submitted to Meta for approval
- [ ] Operator-level toggle: "Use WhatsApp where customer has WhatsApp; fall back to SMS"
- [ ] Customer profile field: `whatsapp_opted_in` (boolean)
- [ ] In-app conversation view shows WhatsApp threads alongside SMS
- [ ] Playwright tests + sandbox messages
- [ ] **Gate**: 1 internal test customer receives a WhatsApp deposit reminder

### Sprint 5 — Route auto-optimization (weeks 10-12)

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
| Phase 1 | Week 6 | 3 P0 features in production |
| Phase 2 | Week 12 | WhatsApp + route optimization in production |
| Phase 3 | Day 90 | 15 US paying customers, ~$735 MRR |
| Phase 4 | Day 180 | 8+ Mexican paying customers OR pivot to US-only doubled budget |
| Phase 5 | Month 6 | 2 InflatableOffice churn customers (conditional) |
| Phase 6 | Month 6+ | 5 Zapier integrations verified (conditional) |
| Phase 7 | Month 9-12 | Car rental vertical deferred (see existing V2 plan) |

---

*Last updated: June 2026. Update the decisions log in [`docs/strategy/README.md`](docs/strategy/README.md) when major decisions change.*
