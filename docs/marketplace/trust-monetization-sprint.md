# Trust & Monetization Sprint — research-grounded definitions

**Created:** 2026-06-12 · **Owner:** founder + Claude · **Status:** definitions approved, build pending

Successor to `improvement-roadmap.md` (all six items shipped). This doc
defines the next six features plus the founder admin, grounded in a
2026-06-12 research pass over the P2P rental graveyard, the survivors,
trust & safety incidents, dispute-ops playbooks, e-sign law, and
delivery economics. Sources cited inline; full reports in the session
transcript.

---

## Strategic rescope (read this first)

The research forces one reframe: **Korent is not "Airbnb for stuff."**
Every horizontal rent-anything P2P died of the same disease — low
rental frequency × low order value, with demand as the starving side
(SnapGoods, NeighborGoods, Zilok, Rentoid, Loanables, Omni). Even the
category winner, Fat Llama, needed a pandemic to break even and exited
for $41.5M. The survivors share a shape: **vertical focus + a
service/insurance layer + structural trust** (Turo/cars,
ShareGrid/cinema gear, BabyQuip/baby gear).

**Therefore:**

- **Lead with Hosting & Events.** High order value ($150–$500),
  inherently bundled (tent + tables + chairs + AV), naturally needs
  delivery + setup, and has repeat buyers (planners, venues). The six
  features below are the toolkit to win ONE vertical — they are much
  weaker spread across every world at once.
- **Keep the other worlds live but instrumented.** Demand capture is
  the instrument; the demand panel in the founder admin is the
  supply-acquisition to-do list that decides which world graduates
  next. Measure search-to-fill, never listings count.
- **Delivery + setup is the moat, not a fee.** BabyQuip's >85% gross
  margins and 50% repeat rate come from the labor layer pure P2P
  avoids. "Delivered and set up" is the pitch that separates Korent
  from a classifieds page.
- **Trust is structural, pre-built, never overstated.** The incident
  playbook (stated guarantee cap, reachable escalation path, the
  founder dispute queue) exists BEFORE launch volume — Airbnb's 2011
  near-death was 24 hours of unreachability, not the ransacking
  itself. And never claim a safety measure that isn't implemented:
  Getaround's $950k fine was for overstating, not for lacking.
- **Explicit non-builds** (research-confirmed traps or premature):
  per-mile/after-hours/rush delivery pricing, `inventory_mode =
  bundle`, multi-seller packages, stored/purchasable badges, paid
  leads, B2B accounts, paid Pro plans, promoted listings, damage
  waivers (until insurance counsel), full video infrastructure.

---

## What the research says (the rules we build by)

1. **Demand is the scarce side.** Every dead generalist (SnapGoods,
   NeighborGoods, Zilok, Rentoid) drowned in willing lenders and
   starved for renters; NeighborGoods peaked at 42k signups / <10k
   active. Demand capture is the most strategic feature here.
2. **Raise dollars-per-transaction; frequency won't grow.** The
   structural killer is low frequency × low order value (TechCrunch
   2015 graveyard analysis). Bundles + delivery/setup + protection
   fees are the escape hatch. Even the horizontal "winner" Fat Llama
   only exited for $41.5M.
3. **The service layer is the moat.** BabyQuip (trained, insured
   providers who deliver AND set up; 22% take + 6–9% service fee; >85%
   gross margins; 50% repeat rate) thrives where pure P2P died.
   Delivery is a moat only when it includes labor (setup), not pure
   transport.
4. **Trust losses compound into balance-sheet death.** Getaround: DC
   AG consumer alert (~75% of DC auto thefts app-linked), $950k fine
   for OVERSTATING safety measures, NYSE delisting, US shutdown Feb
   2025. Turo survived the same category by making risk structural:
   risk-scoring every booking, tiered host plans (payout share ↔
   deductible), Travelers-backed liability.
5. **Disputes are a state machine with hard windows.** Airbnb: file
   within 14 days of checkout → guest gets 24h to respond → 30 days to
   complete evidence. Turo: photos ≤24h before trip start and ≤24h
   after trip end or the claim is dead. Hard windows turn
   he-said/she-said into 5-minute adjudications. (Ours: 24h claim
   window post-completion — Turo-style — keep it.)
6. **Fee math must match the contract to the penny.** Home Depot is in
   class-action litigation over daily-vs-weekly late-fee proration and
   fee-on-fee stacking. Line-item everything pre-payment; never
   default-on an add-on (the force-placed damage-protection suit).
7. **Identity fraud defeats document checks.** Turo's Hawaii fraudster
   passed ID checks with a stolen identity; what limited damage was
   cross-account device/face re-linking and booking-time risk scoring.
   Verify in proportion to value; assume fraud is bidirectional
   (owners pad damage claims too — require owner photo baselines).
8. **Pre-build the EJ playbook.** Airbnb's 2011 crisis cost was
   *unreachability*, not the damage. A guarantee policy with a stated
   cap, a reachable escalation path, and review queues must exist
   before the first viral incident.
9. **Never leak exploitable info pre-booking.** Getaround's listings
   doubled as a thieves' catalog (location + keys inside). Hide
   addresses/serials/storage details until a verified booking exists.
10. **Stale-record enforcement is a lawsuit machine.** Hertz filed
    ~3,365 theft reports/year off a siloed copy of the truth and paid
    $168M. Any punitive workflow (overdue → late fees → escalation)
    needs a real-time recheck against payments/extensions and a
    retraction loop.

---

## 1. Risk-based rental contracts

**Definition (refined from the original prompt):**

- Tiers by replacement value with risk-family floors — unchanged from
  the founder's draft, with one change: **$5,000+ = e_sign_required +
  founder review queue item**, not a hard auto-confirm block with no
  reviewer. The founder admin gets a "high-value review" queue; the
  booking holds at `pending_review` with a 24h SLA. (The draft's
  `manual_review_required` had no reviewer surface; now it has one.)
- **Korent generates the packet** from booking/listing data (no
  uploaded contracts) and snapshots: parties, item, condition,
  replacement value, dates, money lines (incl. delivery/setup),
  late-fee policy stated EXACTLY as computed (Home Depot rule),
  deposit handling, evidence windows, included accessories,
  serial/VIN, dispute rules + claim windows.
- **Who signs (platform reality check):** Turo has NO per-trip signed
  contract (platform ToS only); Peerspace makes the booking itself the
  contract; RVshare is renter-clickthrough. Only Outdoorsy (RVs) does
  a true bilateral ceremony — both parties sign the agreement AND
  co-sign departure/return condition forms, which double as required
  insurance-claim evidence. So: `terms_acceptance` and
  `standard_agreement` = renter clickthrough-accept of the generated
  packet (seller is bound via platform terms at listing time);
  `e_sign_required` = bilateral typed-name (Outdoorsy model) plus a
  co-signed handoff condition checklist at pickup/return.
- **Value-tier precedent:** Turo escalates by vehicle value with extra
  verification + deposits (Deluxe $55–85k: age 25+, extra checks;
  Super Deluxe $85k+: age 30+, mandatory deposit) — never
  notarization. Commercial equipment uses COI + credit applications.
  Our tiers (verification depth + signature ceremony + founder review
  by replacement value) match industry practice exactly.
- **E-sign per Meyer v. Uber, avoiding every Berman defect** (ESIGN 15
  U.S.C. §7001, UETA): uncluttered screen; agreement hyperlink blue
  and underlined; notice directly adjacent to the action button;
  button text states "By clicking Sign, you agree to the Rental
  Agreement"; typed-name field + checkbox for e_sign tier. Typed
  names are valid e-signatures (BrewFab v. 3 Delta) when intent +
  attribution + retention are captured.
- **Audit trail per signature event:** timestamp, signer profile +
  email, IP, user agent, and a SHA-256 hash of the exact agreement
  markdown signed. Once any party accepts/signs, the snapshot is
  immutable; term changes (incl. **extensions** — they change dates
  and totals) void and regenerate as an addendum packet.
- **Instant book interplay:** instant reserve still holds the dates;
  payment is gated on the required contract step, not the reserve.
- **Multi-item bookings:** the packet snapshots every line item.
- Two tables only: `market_contract_packets`,
  `market_contract_signatures` (templates live in code like the
  registry; events ride `market_booking_events`).
- One lawyer pass over the generated template before launch
  (arbitration + class-waiver language is now standard across
  Airbnb/Turo — Selden v. Airbnb upheld it; include small-claims
  carve-out).

## 2. Delivery / setup monetization

**v1 scope (trimmed per research + codebase reality):**

- Industry norms: round-trip base fees ($55–$425 by time-window
  tightness at Party Rental Ltd.), **$250 delivery order minimums**,
  per-item setup lines ($4/table, $1/folding chair at American Party
  Rentals), stairs/long-carry surcharges, after-hours multipliers.
  Trade press (RER "Charge and Deliver"): delivery often runs at a NET
  LOSS without minimums and surcharges — price at true cost.
- **Build:** `delivery_base_fee_cents` (round-trip, flat),
  `setup_fee_cents`, `teardown_fee_cents`, `delivery_min_subtotal_cents`,
  `free_delivery_radius_miles`, `max_delivery_radius_miles` on
  listings (seller defaults on the seller profile). Renter picks
  pickup vs delivery at checkout; delivery requires an address field
  and radius check against the metro (simple — no geocoding v1).
- **Defer:** per-mile fees (needs geocoding + renter address
  infrastructure), after-hours/rush fees (needs time-of-day pickup
  selection). BabyQuip model note: seller sets the fee and keeps the
  normal split — platform fee applies to delivery/setup (it's
  revenue), never to deposits or taxes.
- Checkout shows every line BEFORE payment: rental, delivery, setup,
  teardown, tax, deposit hold (labeled refundable), total due today.

## 3. Hosting & Events package builder

- **Reuse, don't rebuild:** same-seller multi-item bookings already do
  atomic multi-listing holds, order-level deposits, one payment, line
  items everywhere. NO `inventory_mode = bundle` — package
  availability = min available across required components, computed
  from existing holds (`market_reserve_holds_multi` already counts
  line items).
- A package is a curated listing row pointing at components:
  `market_listing_components` (package_listing_id → component_listing_id,
  qty, is_required) + `market_listing_addons` (reservable |
  non_reservable, price, qty).
- One delivery fee amortized across the package is exactly how event
  rental firms hit their minimums — packages and delivery ship
  together or delivery first.
- Marketplace UI: package card, included components, optional add-ons,
  starting price, delivery/setup requirement.

## 4. Verified seller trust badges

- **Computed, never stored** (pure functions over real data + short
  cache): stored badges drift stale, and "can't buy fake badges" is
  enforced for free when badges derive from behavior. Getaround's
  $950k fine for overstating safety = never badge what you haven't
  verified.
- v1 set (all computable today): `fast_responder` (median first-reply
  < 2h from messages), `photo_evidence_ready` (proof-of-function
  present where the risk family requires it), `delivery_available`,
  `korent_operator` (org is an operator, not marketplace_seller),
  `completed_rentals` (≥3 completed), `low_dispute_rate` (<2% after
  ≥10 bookings). `id_verified` ships FALSE until a seller-side
  verification provider exists (renter-side verification ≠ seller).
  `contract_ready` becomes meaningful after feature 1.
- **The Superhost recipe (works):** few published, countable,
  self-checkable criteria over a TRAILING 12-MONTH window, recomputed
  on a calendar cadence (Airbnb: quarterly; eBay: monthly). Measured
  lift is real (Liang et al. 2017: more bookings + price premium;
  Airbnb's own figure: Superhosts earn ~64% more — correlation).
- **The Star Seller anti-recipe (backfired into the 2022 Etsy
  strike):** short 3-month windows on small denominators (one 4-star
  review strips the badge), metrics sellers can't control
  (carrier-caused lateness), system messages counting against
  response rate, and gameable mechanics (spam-marking unanswered
  messages, emoji auto-replies). Etsy loosened criteria within 9
  months. Rules for us: only badge outcomes the seller controls,
  exclude system/spam messages from response math from day one,
  minimum volume floors, 12-month lookback.
- Surfaces: listing cards, PDP, store page, checkout trust box +
  seller-hub checklist showing live standing against each criterion
  (eBay-style progress view prevents "why did I lose it?" rage).
- Recompute on read with a few-minute cache v1; calendar assessment
  windows can come with scale. Tie badges into search ranking later —
  that's where the conversion lift actually comes from.

## 5. Demand capture

- **Extends what exists:** `market_world_waitlist` +
  `market_demand_events` already capture smoke-test world demand.
  Add the richer request shape (category, query, dates, zip, budget,
  delivery_required, notes, status: new|matched|notified|closed) —
  either widen `market_world_waitlist` or add
  `market_demand_requests`; reuse the existing dedupe + PII posture
  (service-role only).
- New surfaces: no-results search, coming-soon categories, homepage
  "Can't find what you need?" CTA.
- Founder admin gets a demand panel: requests by category/metro —
  this is the supply-acquisition to-do list (research rule #1).
- Free leads v1; demand intelligence only.

## 6. Listing quality score

- Deterministic 0–100, computed on read (like the pricing
  calculator), no table. Weights per the founder draft, with
  `photos_complete` capped to what the product supports today
  (single photo) — **multi-photo upload is a prerequisite to give
  that component real range** and is now an explicit sub-task.
- Loanables' postmortem: trust was the #1 abandonment driver and
  conversion was ~0.5% — quality scoring exists to surface only
  listings likely to convert, not to shame sellers.
- Surfaces: seller hub listing card ("72/100" + top 3 suggestions);
  later a mild ranking boost (defer actual ranking changes).

## Founder admin (shipping now, this sprint)

- **Exists already:** `/dashboard/market-admin` gated by
  `PLATFORM_ADMIN_EMAILS` — dispute resolution (sole deposit-capture
  path), listing review queue, flagged conversations, follow-up
  triage, support inbox, renter-identity links scoped to disputes.
- **Added in this sprint:** marketplace health header (GMV 30d,
  platform revenue 30d, active rentals, dispute rate per completed,
  open-dispute age, listings/sellers, searches, waitlist, standby,
  deposit failures) + SaaS overview line (orgs, marketplace sellers,
  new orgs 30d, app errors 24h).
- **Next (with features above):** high-value contract review queue
  (feature 1), demand-requests panel (feature 5), evidence checklist
  in the dispute card (timestamped photos present? both parties?
  receipts?) per the AirCover adjudication pattern.
- **Queue design rule (Stripe Radar pattern):** every moderation
  surface is one queue + a detail pane + a SMALL ENUM of resolutions +
  a required reason + an append-only audit log (ours:
  `market_booking_events`). Throughput charting later.
- **Metrics to add as data accrues (Lenny/a16z canon):** fill rate
  (intentful searches → confirmed rentals), median time-to-first-
  booking for new listings (supply quality), repeat-rental rate by
  renter cohort, GMV retention by cohort, and top-10-seller GMV share
  (alert at ~30–40% — supplier concentration is an early structural
  warning). Today's header covers GMV/take/disputes/liquidity inputs.
- **Deliberately NOT building:** "log in as user" impersonation
  (Sharetribe's top support tool, but a serious security/privacy
  footgun for a solo founder — revisit with real support volume).

## Compliance audit: what's already built vs the research (2026-06-12)

Full codebase audit against the 10 rules. Clean: pre-booking info
hygiene (no serials/addresses/locations exposed — rule 9 ✓), demand
instrumentation (every search logged incl. zero-results ✓), deposit
labeling ("authorized, not charged, refundable" ✓), cancellation tiers
disclosed ✓, server-side evidence timestamps ✓, claim window enforced ✓.

**Fix list (ranked by risk):**

- [ ] **"Verified" copy (CRITICAL — Getaround-class).** Marketing copy
  says "verified local sellers" (market home, layout, world pages,
  store pages) and "photo evidence built in". Reality: sellers pass
  Stripe Connect KYC (a real identity verification of the payout
  holder) but NO background check; evidence is optional, not built-in
  as a guarantee. Fix: define "verified" precisely at every use
  ("identity verified through our payments partner — not a background
  check") and soften "photo evidence built in" to "photo evidence
  tools on every rental". Getaround's $950k fine was for this exact
  gap between copy and implementation.
- [ ] **Late-fee formula undisclosed pre-rental (HIGH — the Home Depot
  suit).** We charge daily rate + $20/day capped at 3 days
  (lib/market/cancellation.ts) but the renter first learns fees exist
  when overdue. Fix: state the exact formula on the PDP and in the
  (future) contract packet.
- [ ] **No cost line-items before payment (HIGH).** Renter sees a
  combined total; platform fee never itemized; no cost preview at
  request time. Fix: subtotal / tax / deposit-hold / total-due-today
  lines on the awaiting-payment card (renter pays no separate platform
  fee today — fee comes out of the seller side — so say THAT too; it's
  a selling point).
- [ ] **Overdue flip lacks a pre-flip recheck (HIGH — the Hertz rule).**
  market-cleanup-holds flips checked_out → overdue without rechecking
  whether an extension was just approved (cron race). Fix: recheck
  pending/approved extensions + CAS guard before the flip.
- [ ] **No seller condition baseline (HIGH — fraud is bidirectional).**
  Evidence is optional both sides; disputes over pre-existing damage
  are unadjudicable without a baseline. Fix: make the seller handoff
  photo blocking before "checked out", per Turo/Outdoorsy condition-
  form practice.
- [ ] **High-value instant book has no extra guard (MEDIUM).**
  Electronics instant book is now seller-discretion with no
  value-tiered renter friction (Turo Deluxe pattern: extra checks +
  deposits above value thresholds). Fix lands with the contracts
  feature (e-sign tier gates payment anyway).
- [ ] **`had_results` flag on demand events (LOW).** Zero-result
  searches are only inferable; add the flag with feature 5.

## Addendum review: "Live Verify" (founder draft, 2026-06-12)

**Verdict: right instinct, wrong default shape.** Pre-booking condition
confidence for high-value items is a real gap — but a REQUIRED
synchronous 5-minute video call between two strangers re-creates the
SnapGoods coordination friction that killed P2P conversion, and a live
call raises four legal/trust problems the research flagged:

1. **Serial/VIN reveal to unbooked strangers is theft casing**
   (Getaround's app became a thieves' catalog; Turo's Hawaii fraudster
   did exactly this recon). Never show serial/VIN/plate closeups or
   location context to anyone without a verified identity AND an
   active booking request.
2. **"Verify" language creates platform liability.** If Korent brands
   a checklist "Verified ✓", a renter with a defective item argues the
   platform vouched for condition — and Getaround's $950k fine was for
   overstating safety measures. The platform never verifies; the
   SELLER demonstrates. Name it "Live Look" / "Condition Proof", record
   results as "seller demonstrated X", and disclaim in the packet.
3. **Recording a live call triggers two-party-consent wiretap laws**
   (CA, WA, etc.). The draft correctly says no recording — but an
   UNRECORDED call also produces NO retained evidence, which defeats
   half the purpose.
4. **A live call is an unmoderated leakage channel** — the moderation
   engine can't see video; participants will swap numbers. Schedule
   in-product, copy says "not a negotiation call", accept residual
   risk.
5. **Operational flaw: required-before-confirmation + two-sided
   scheduling cannot fit inside hold TTLs.** Bookings would die
   waiting for two calendars to align.

**Reshaped v1 — "Condition Proof" (async), live call optional later:**
- Required tier (≥$2,500 replacement, towable-road,
  high-value-electronics, zero-history sellers on high-value): the
  seller uploads a checklist-driven set of photos or a SHORT
  SELF-RECORDED video (seller filming their own item = no consent
  issue, and the evidence is RETAINED) within the booking-response
  window. Async = no scheduling friction, no hold-TTL conflict.
- Optional tier: renter can request a live look; seller
  accepts/schedules in-product; no recording v1; checklist + photo
  upload as the artifact. Keep the draft's tables (collapse to
  requests + results; events ride market_booking_events; checklist
  templates in code like the registry).
- Serial/VIN items in the checklist unlock only after the renter is
  verified and the booking request exists.
- Badge copy: "Condition proof provided" (seller action), never
  "Verified by Korent".
- The draft's hierarchy is correct and stays: never replaces
  contracts, deposits, or pickup/return evidence; never triggers early
  deposit holds.

## Build order

1. Demand capture (smallest, most strategic, extends existing tables)
2. Listing quality score (+ multi-photo prerequisite)
3. Trust badges (computed service)
4. Delivery/setup fees (trimmed v1)
5. Contracts (largest; lawyer pass on template; admin review queue)
6. Package builder (reuses multi-item; ships with delivery)

Legend for the build phase: each feature gets its own checklist PR by
PR, same pattern as `improvement-roadmap.md`.
