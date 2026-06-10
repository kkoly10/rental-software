# Korent Marketplace — Master Implementation Spec

You are continuing work in the repo:

kkoly10/rental-software

Your job is to design and build the marketplace system inside the same repository, following the architecture and product decisions below.

This is NOT a brainstorming task.
This is an implementation task.

You must preserve the existing operator SaaS, storefront, auth, onboarding, multi-tenant model, RLS posture, and current repo direction.
Do not restart from scratch.
Do not redesign unrelated systems.
Do not tightly couple the marketplace to operator-app internals.

==================================================
0. PRIMARY OBJECTIVE
==================================================

Build a trusted multi-world rental marketplace for expensive things people need temporarily.

Marketplace worlds:
- Home & Projects
- Hosting & Events
- Baby Gear
- Creator Gear
- Trailers & Hauling
- Office & Pop-Up
- Seasonal & Emergency

This marketplace should feel:
- like eBay/Amazon for browsing
- like Turo/Airbnb for booking and trust
- like a serious operational platform under the hood

The marketplace must support:
- verified renters and sellers
- seller storefronts
- listing publication
- pricing intelligence
- deposits/holds
- reservation locks
- pickup/return evidence
- disputes and support
- in-app messaging
- seller payouts
- operator fulfillment projection
- admin/trust tooling

==================================================
1. HIGH-LEVEL ARCHITECTURE
==================================================

Use one repository with separate bounded contexts.

Recommended app/package structure:

apps/
- operator
- marketplace
- admin (or trust)

packages/
- rental-core
- marketplace-domain
- trust-safety
- payments-core
- policy-registry
- event-bus
- ui-tokens (design tokens only)

Do NOT:
- make the marketplace just another thin page inside the operator app
- directly reuse operator page actions/components for marketplace logic
- duplicate the full booking/availability engine in a separate independent codebase

Correct pattern:
- shared rental core
- isolated marketplace transaction domain
- operator fulfillment projection bridge
- separate app surfaces and ideally separate deployments

==================================================
2. SHARED VS ISOLATED SYSTEM BOUNDARY
==================================================

SHARED CORE:
- organizations
- profiles / memberships
- products
- assets
- media storage primitives
- location/address primitives
- availability engine primitives
- pricing primitives
- notifications infrastructure
- audit/event infrastructure

MARKETPLACE-ONLY:
- seller storefronts
- marketplace listings
- category/risk-based listing publication
- booking reservations
- marketplace bookings
- reviews
- ranking/search metrics
- messaging
- verification workflows
- proof-of-function media
- pickup/return evidence
- disputes / claims
- payout logic
- anti-leakage logic

OPERATOR-ONLY:
- internal dashboard ops
- CRM-like internal order pipeline
- route board / logistics board
- internal accounting views
- staffing / crew workflows
- internal documents workflow

BRIDGE MODEL:
Marketplace booking should NOT simply be a raw operator order.

Instead:
- marketplace owns renter-facing commercial lifecycle
- operator owns fulfillment projection lifecycle

When marketplace booking is confirmed, emit bridge event(s) and create operator fulfillment projection.

==================================================
3. WORLD TAXONOMY
==================================================

Top-level worlds:
- home-and-projects
- hosting-and-events
- baby-gear
- creator-gear
- trailers-and-hauling
- office-and-pop-up
- seasonal-and-emergency

Every listing must have:
- 1 world slug
- 1 category slug
- 1 risk family slug
- optional secondary tags

Secondary tags should exist for cross-world behavior like:
- furniture
- event-furniture
- office-furniture
- staging-furniture
- lounge-furniture
- powered-equipment
- motorized-equipment
- electric-equipment
- high-value
- high-fraud-risk
- manual-review-preferred
- child-contact
- food-contact
- sanitation-sensitive
- delivery-heavy
- pickup-preferred
- onsite-setup
- multi-component
- serial-required
- vin-required
- restricted-item
- age-restricted

==================================================
4. CATEGORY TREE
==================================================

WORLD: home-and-projects
Categories:
- access-and-ladders
- yard-and-landscaping
- cleaning-and-restoration
- flooring-and-interior-finishing
- cutting-drilling-and-demolition
- painting-and-surface-prep
- power-and-jobsite-support
- staging-and-temporary-furniture
- inspection-and-specialty

WORLD: hosting-and-events
Categories:
- tents-and-canopies
- tables
- chairs-and-seating
- lounge-and-event-furniture
- dance-floors-and-staging
- photo-booths
- concessions-and-food-service
- audio-visual-and-presentation
- climate-and-comfort
- decor-and-backdrops
- games-and-entertainment
- event-utility-equipment

WORLD: baby-gear
Categories:
- sleep-and-nursery
- strollers-and-mobility
- feeding-and-mealtime
- monitoring-and-safety
- play-and-soothing
- travel-and-on-the-go
- premium-support-gear

WORLD: creator-gear
Categories:
- cameras-and-bodies
- lenses-and-optics
- audio-and-podcast
- lighting-and-grip
- support-and-stabilization
- streaming-and-production
- backgrounds-and-sets
- monitors-and-accessories
- event-capture-systems

WORLD: trailers-and-hauling
Categories:
- utility-and-flatbed-trailers
- enclosed-trailers
- dump-trailers
- vehicle-transport
- moving-equipment
- cargo-carriers-and-hitch-gear
- tie-down-and-hauling-accessories

WORLD: office-and-pop-up
Categories:
- desks-and-workstations
- chairs-and-seating
- tables-and-meeting-furniture
- displays-and-signage
- presentation-and-av
- pos-and-check-in
- printing-and-scanning
- wifi-power-and-connectivity
- booth-fixtures-and-merch-displays
- office-furniture

WORLD: seasonal-and-emergency
Categories:
- backup-power
- water-damage-and-restoration
- heating-and-cooling
- storm-and-cleanup
- snow-and-ice
- temporary-lighting-and-safety
- pumps-and-drainage
- temporary-shelter-and-site-protection

==================================================
5. RISK FAMILIES
==================================================

Use these risk families:
- passive-standard
- furniture-standard
- powered-standard
- electronics-standard
- high-value-electronics
- towable-road
- baby-sensitive
- food-contact
- restoration-and-emergency
- multi-component-event
- manual-review-restricted

Map categories to these risk families in a policy-registry layer.

==================================================
6. WORLD / CATEGORY OPERATING MATRIX
==================================================

Each category/risk family must resolve the following defaults:
- booking mode default
- deposit mode default
- proof-of-function required or not
- sanitation class
- identity verification level
- seller review requirement
- instant-book allowed or not
- delivery allowed or not
- default cancellation preset
- dispute sensitivity
- minimum booking subtotal
- late fee / extension default
- accessories checklist requirement
- serial / asset identity requirement
- proof freshness interval
- restricted/prohibited item rules
- return inspection template

Risk family defaults must exist and world/category overrides may refine them.

==================================================
7. INVENTORY MODEL
==================================================

Only 3 inventory modes are allowed:

1. serialized
- one asset record = one rentable unit
- used for trailers, cameras, generators, projectors, high-value units

2. quantity-based
- reserve quantity, not a specific unit
- used for chairs, tables, simple commodity inventory

3. bundle/composite
- booking reserves required components and optional add-ons
- used for tent packages, AV kits, booth kits, camera kits, trailer bundles

Do NOT let one listing behave as both serialized and quantity-based at the same time.

Add-ons must be classified as:
- non-reservable add-ons (pricing only)
- reservable add-ons (pricing + availability impact)

==================================================
8. PRICING ENGINE
==================================================

Build a deterministic pricing system backed by database configuration and benchmark data.

Required layers:
1. pricing policy library
2. benchmark library
3. pricing engine service
4. seller calculator
5. optional auto-pricing mode

Recommended category-family target bands:
- passive-standard: target daily ≈ 4% of replacement value
- furniture-standard: target ≈ 5.5%
- powered-standard: target ≈ 10%
- electronics-standard: target ≈ 6.5%
- high-value-electronics: target ≈ 4%
- towable-road: target ≈ 3.5%
- baby-sensitive: target ≈ 5%
- food-contact: target ≈ 6.5%
- restoration-and-emergency: target ≈ 12%
- multi-component-event: target ≈ 7.5%

Pricing engine must output:
- hourly/day/weekend/weekly recommendations
- low/recommended/premium bands
- deposit recommendation
- delivery recommendation
- payout after platform fee
- recover-cost estimate
- confidence level
- deterministic explanation

Marketplace fee defaults:
- 12% default marketplace seller fee
- 8% for Korent operators
- $4 minimum platform fee
- no fee on refundable deposit holds

==================================================
9. DEPOSIT ENGINE
==================================================

Deposit must be risk-based and time-aware.

Estimated used value fallback:
estimated_used_value =
replacement_value × age_factor × condition_factor

Age factors:
- 0–12 months: 0.85
- 1–3 years: 0.70
- 3–5 years: 0.55
- 5+ years: 0.40

Condition factors:
- new: 1.00
- excellent: 0.95
- good: 0.85
- fair: 0.70
- worn: 0.50

Base deposit formula:
base_deposit =
(estimated_used_value × risk_family_pct)
+ (high_risk_accessories_value × 0.50)

Then clamp by category floor/cap and never exceed estimated used value.

Risk-family deposit defaults:
- passive-standard: 15%, floor $50
- furniture-standard: 20%, floor $75
- powered-standard: 25%, floor $100
- electronics-standard: 25%, floor $100
- high-value-electronics: 35%, floor $250
- towable-road: 40%, floor $300
- baby-sensitive: 20%, floor $75
- food-contact: 20%, floor $75
- restoration-and-emergency: 30%, floor $150
- multi-component-event: 25%, floor $150

Deposit strategies:
- none
- auth_hold
- captured_refundable
- manual_review

Critical rule:
Do NOT place damage authorization holds too early.
Place them close to pickup/handoff.

Use auth holds only when safe hold window <= 96 hours.
Otherwise use captured refundable deposit.

Towable-road and high-value-electronics should lean stricter.

==================================================
10. RESERVATION HOLD / EXPIRY MODEL
==================================================

Reservation states:
- none
- checkout_hold
- verification_hold
- awaiting_seller
- awaiting_renter_payment
- confirmed
- expired
- released

TTL defaults:
- checkout_hold: 15 min
- verification_hold: additional 15 min (30 min max combined)
- awaiting_seller: 2 hours
- awaiting_renter_payment: 30 min

Add standby queue concept:
- one active hard hold on inventory slot
- additional interest can sit in standby
- standby does not block inventory
- standby can be promoted when hold expires

Run hold cleanup every 5 minutes.

Availability must consider hard holds plus confirmed availability blocks.

==================================================
11. GEO BENCHMARK INGESTION WORKFLOW
==================================================

Build a reviewed benchmark pipeline, not direct raw scraping into pricing.

Pipeline:
1. raw capture
2. normalization
3. review / outlier filtering
4. published benchmark snapshots

Geo fallback chain:
1. exact metro / city cluster
2. state / region
3. ZIP3 prefix
4. national same-category
5. national same-risk-family

Update cadence:
- nightly internal data rollups
- weekly manual/public-source updates
- nightly snapshot publish after validation

Use confidence levels:
- high
- medium
- low

At launch, prioritize curated manual inputs + internal marketplace data rather than uncontrolled automation.

==================================================
12. VERIFICATION / TRUST
==================================================

Use progressive verification.

At signup:
- email verification
- phone verification

Before first booking:
- identity verification
- selfie / liveness
- payment method

Before first payout:
- seller KYC / Stripe onboarding
- payout details
- business info if needed

Higher-risk categories require stronger rules:
- trailers-and-hauling
- high-value-electronics
- certain baby-sensitive categories
- certain powered-standard categories

==================================================
13. BOOKING MODEL
==================================================

v1 booking rule:
- one primary listing per booking
- avoid multi-seller cart in v1

Booking state machine:
- draft
- pending_verification
- pending_seller_approval
- awaiting_payment
- confirmed
- ready_for_handoff
- checked_out
- overdue
- returned_pending_review
- completed
- cancelled
- disputed

Marketplace owns renter-facing booking lifecycle.

==================================================
14. TURNAROUND / AVAILABILITY BUFFERS
==================================================

Every listing must support:
- prep_buffer_before_minutes
- recovery_buffer_after_minutes

Availability uses:
effective_start = requested_start - prep_buffer_before
effective_end = requested_end + recovery_buffer_after

Default family buffers:
- passive-standard: prep 0–60m, recovery 60m
- furniture-standard: prep 2h, recovery 4h
- powered-standard: prep 2h, recovery 12h
- electronics-standard: prep 1h, recovery 4h
- high-value-electronics: prep 2h, recovery 24h
- towable-road: prep 4h, recovery 24h
- baby-sensitive: prep 4h, recovery 24h
- food-contact: prep 4h, recovery 24h
- restoration-and-emergency: prep 1h, recovery 12h
- multi-component-event: prep 6–24h, recovery 12–24h

==================================================
15. PAYMENTS, TAX, REPORTING, CHARGEBACKS
==================================================

Use Stripe Connect for marketplace payouts.

Separate ledgers:
- booking ledger
- seller settlement ledger
- tax ledger
- reporting ledger

Do NOT hard-code one universal tax collection assumption.
Tax responsibility must be jurisdiction-configurable and legally reviewed for launch jurisdictions.

Chargebacks are a separate system from marketplace disputes.

Chargeback flow:
- freeze seller payout balance for affected booking
- freeze unreleased funds if needed
- create chargeback case
- generate evidence bundle
- track issuer deadline separately from internal dispute SLA

Internal disputes and chargebacks may both exist at once.
Chargeback state controls money movement.

==================================================
16. PICKUP / RETURN EVIDENCE
==================================================

This is mandatory.

At pickup:
Seller submits:
- condition photos
- proof-of-function if required
- accessories checklist

Renter submits:
- acknowledgment photos
- visible condition acknowledgment
- working acknowledgment where relevant

At return:
Renter submits:
- return photos
- accessory return checklist

Seller submits:
- inspection photos
- issue report if damaged / missing / dirty / late

Evidence must be linked to booking and preserved for disputes.

==================================================
17. DISPUTES / CLAIMS
==================================================

Dispute types:
- item_not_working
- damage
- missing_accessories
- late_return
- non_return
- condition_mismatch
- seller_no_show
- renter_no_show
- billing_issue

Dispute statuses:
- open
- awaiting_renter_evidence
- awaiting_seller_evidence
- admin_review
- resolved_renter_liable
- resolved_seller_liable
- resolved_split
- resolved_no_fault
- closed

Support/admin must be able to:
- request evidence
- freeze payout-related funds
- decide claim allocation
- apply deposit partially/fully
- mark insufficient evidence

==================================================
18. IN-APP MESSAGING
==================================================

Use one visible conversation system with hidden commerce phases.

Visible UX:
- free-form chat by default
- structured actions as optional helpers
- one continuous thread across inquiry → booking → support
- support/admin can join in-thread
- system cards appear inline

Hidden conversation phases:
- inquiry
- booking_requested
- awaiting_payment
- confirmed
- handoff_window
- active_rental
- return_window
- case_open
- completed
- restricted
- archived

Messaging must support:
- listing inquiries
- booking coordination
- extension requests
- issue reports
- support/dispute communication

Hard-block only:
- off-platform payment instructions
- early phone/email/address sharing
- malicious links
- serious fraud / abuse attempts

Soft-warn suspicious but not strictly forbidden behavior.

Messaging performance must feed:
- seller trust score
- response-time score
- ranking

Use dedicated marketplace conversation tables and controlled write paths.
Do not make this generic unrestricted chat.

==================================================
19. SUPPORT / MODERATION OPS
==================================================

Use 5 queues:
1. listing moderation
2. trust & verification
3. booking support
4. disputes & claims
5. payments & chargebacks

SLA guidance:
- P0 safety/fraud/chargeback freeze: <1h
- P1 booking-blocking issue: <4h
- P2 listing moderation / verification: <24h
- P3 non-urgent seller help: 1–2 business days
- disputes: acknowledge immediately, evidence 48h, simple resolution 72h, complex 5 business days

Auto-decision rules should exist for:
- expired holds
- missing required identity step
- prohibited item listings
- no seller response by SLA
- low-risk extension approvals when no conflict exists

==================================================
20. MESSAGING MODERATION
==================================================

Implement a rule table and moderation engine for messaging.

Hard-block examples:
- direct phone number before allowed stage
- direct email before allowed stage
- payment handles or external payment instructions
- exact address too early
- malicious links
- fraud phrases
- severe abuse

Soft-warn examples:
- "I can do cheaper outside the app"
- social handles
- suspicious shortened links
- repeated attempts to move conversation elsewhere

Use leakage risk score with escalating actions:
- thread flag
- account review
- thread restriction
- trust escalation

==================================================
21. SEARCH / RANKING
==================================================

Ranking inputs should include:
- availability
- distance
- listing quality score
- media completeness
- proof-of-function presence where required
- seller verification
- response time
- inquiry response rate
- completion rate
- dispute rate
- cancellation rate
- conversion history

Do not rank purely by price.

==================================================
22. SELLER STOREFRONTS
==================================================

Each seller should have:
- store name
- slug
- logo / banner
- description
- service radius
- pickup/delivery flags
- ratings and review count
- verification badges
- response-time indicators
- live inventory

Korent operators and marketplace-only sellers should both fit the organization model, but marketplace-only sellers can have lighter operator tooling.

==================================================
23. SELLER ECONOMICS
==================================================

Marketplace sellers:
- 12% fee
- $4 minimum platform fee

Korent operators:
- 8% fee
- same minimum platform fee unless explicitly overridden

No platform fee on refundable deposit holds.

Pricing UI must show:
- recommended prices
- estimated payout after fee
- recover-cost estimate
- low/recommended/premium bands
- confidence level

==================================================
24. COMMUNICATIONS MATRIX
==================================================

Stage-based communication rules:
- pre-booking: masked contact, in-platform only
- booking requested: seller response SLA, still masked
- confirmed pre-handoff: operational coordination opens gradually
- active rental: extension/issues allowed
- return: return coordination and evidence prompts
- case open: support/admin-driven evidence and resolution

Notifications must support:
- inquiry
- seller response needed
- booking approved/rejected
- payment captured
- pickup reminder
- return reminder
- extension request
- issue report
- dispute opened
- case resolved
- payout released

==================================================
25. RESTRICTED / PROHIBITED ITEMS
==================================================

Use 4 restriction levels:
- prohibited
- restricted_manual_review
- allowed_with_extra_requirements
- allowed_standard

Examples that should be prohibited or heavily restricted:
- firearms/ammo
- explosives
- hazardous chemicals
- illegal surveillance equipment
- recalled baby products
- unsafe/unverifiable trailers
- medical/life-support devices without special compliance
- stolen/unverifiable property

Claude must create a policy registry and explicit seed list, and flag any geography-sensitive items for manual legal review.

==================================================
26. MARKETPLACE MESSAGING TECHNICAL MODEL
==================================================

Build the messaging system around:
- marketplace conversations
- participants
- messages
- attachments
- moderation events
- structured actions
- conversation events
- support cases

Use read-through RLS and controlled write functions / server actions.
Do not allow free-form client inserts directly into core messaging tables without business-rule enforcement.

==================================================
27. EVENT BRIDGE: MARKETPLACE → OPERATOR
==================================================

Use outbox/inbox pattern with idempotency.

Marketplace emits:
- marketplace.booking.confirmed
- marketplace.booking.cancelled
- marketplace.booking.ready_for_handoff
- marketplace.booking.checked_out
- marketplace.booking.overdue
- marketplace.booking.returned_pending_review
- marketplace.booking.completed
- marketplace.dispute.opened
- marketplace.dispute.resolved

Operator creates/maintains fulfillment projection:
- ops.fulfillment_order
- asset prep tasks
- inspection tasks
- delivery tasks

Operator emits back to marketplace as needed:
- ops.fulfillment.ready_for_handoff
- ops.handoff.pickup.completed
- ops.return.inspection.completed
- ops.asset.maintenance.flagged
- ops.asset.back_in_service

Marketplace remains source of truth for commercial lifecycle.
Operator remains source of truth for fulfillment lifecycle.

==================================================
28. BUILD ORDER
==================================================

Phase 1
- bounded app/package structure
- policy registry
- world/category/risk-family config
- restricted item policy
- seller storefront model
- marketplace listing model

Phase 2
- inventory modes
- reservation holds
- booking engine
- turnaround buffers
- pickup/return evidence model

Phase 3
- pricing library schema
- benchmark library
- pricing engine
- seller calculator
- pricing admin tools

Phase 4
- verification / trust
- Stripe Connect payouts
- deposit engine
- ledgers
- tax/reporting scaffolding
- chargeback case model

Phase 5
- messaging system
- moderation rules
- support cases
- in-thread admin join
- notifications

Phase 6
- disputes / claims
- search/ranking
- quality scoring
- anti-leakage
- review system

Phase 7
- operator bridge events
- fulfillment projection
- admin/trust surfaces
- analytics and launch-readiness tooling

==================================================
29. OUTPUT REQUIREMENTS
==================================================

Before coding:
1. Audit the current repo state and summarize what already exists that should be reused.
2. Identify where marketplace should be isolated from operator app code.
3. Propose the exact folder/package plan before implementing.

During implementation:
- use clean migrations
- keep marketplace tables in a bounded context/schema when appropriate
- preserve existing auth/multi-tenant/RLS discipline
- do not silently change unrelated operator flows
- prefer deterministic rule systems over vague AI behavior

When reporting progress, always include:
1. what was audited
2. what was already reusable
3. what was added
4. what files were modified
5. what migrations were added
6. what env vars/providers are required
7. what still remains unresolved
8. exact commands/steps to test locally

==================================================
30. THINGS NOT FULLY DECIDED YET — DO NOT FAKE THEM
==================================================

If these remain unresolved in code, flag them explicitly instead of pretending they are done:
- exact launch jurisdictions and marketplace-facilitator tax setup
- exact KYC/ID provider choice
- final restricted-items legal review by geography
- launch metro/liquidity targets
- final benchmark seed data coverage by category
- exact support staffing assumptions
- final notification channel/provider policy if multiple options exist

Build the system so these can be configured later without redesign.

==================================================
31. LAUNCH SCOPE & WORLD GRADUATION GATES
==================================================

All 7 worlds exist in the policy registry from day one.
Only 1 world operates live at launch.

LIVE AT LAUNCH:
- hosting-and-events, in 1-2 launch metros only
- supply seeded by existing Korent SaaS operators at the 8% operator fee
- categories map directly to the SaaS verticals already shipped
  (inflatables, tents, tables/chairs, dance floors, photo booths, concessions)

SMOKE-TEST MODE (the other 6 worlds):
- world and category pages are browsable ("coming soon" state)
- search works and demand is logged per world / category / metro
- renters can join a notify-me waitlist per world + metro
- sellers can pre-list inventory (draft listings, not bookable)
- NO live bookings, NO payments, NO trust-ops, NO insurance exposure,
  NO restricted-items legal review spend in smoke-test worlds

Measure per world per metro:
- renter searches
- waitlist joins
- seller pre-listings (count and inventory value)
- seller signups attributable to the world

GRADUATION GATE (smoke-test world -> live world in a metro):
A world goes live in a metro only when, within a rolling 60 days:
- >= 25 seller pre-listings in that metro, AND
- >= 200 renter searches or >= 75 waitlist joins in that metro, AND
- restricted-items legal review for that world is complete, AND
- deposit/pricing defaults for its risk families are calibrated

Gates are configuration, not code. Tune thresholds with real data;
do not hard-code them.

WORLD #2 CANDIDATE ORDER (from docs/strategy/05-vertical-roadmap.md scoring):
1. creator-gear — thin SaaS competition, ShareGrid ~20% commission is the
   wedge the 12% fee undercuts
2. home-and-projects / seasonal-and-emergency — viable but price-capped by
   Home Depot / Sunbelt rental rates
3. baby-gear — BabyQuip incumbent + child-safety/recall liability; needs
   strongest sanitation + recall enforcement before going live
4. office-and-pop-up — low frequency, B2B; consider folding into
   hosting-and-events via tags instead of a standalone live world
5. trailers-and-hauling — LAST; road-insurance and state title/registration
   liability are unresolved (deposits + VIN checks are not sufficient).
   Do not go live without a real insurance answer.

RATIONALE:
Marketplace liquidity is geo + category specific. Operating all 7 worlds
at launch splits demand-gen spend 7 ways, produces inconclusive results
everywhere, and shows renters empty search results in 6 worlds. Smoke-test
mode preserves the 7-world experiment at a fraction of the cost: it tests
intent (searches, waitlists, pre-listings) instead of operations, and
measured demand — not guesswork — picks which world goes live next.
