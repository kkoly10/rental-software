# Build Tracker — Trust & Monetization Sprint

**Created:** 2026-06-12 · **Owner:** founder + Claude · **Status:** in progress

Execution checklist for `trust-monetization-sprint.md` (definitions,
research, and the locked rental flow live there — this file is only
what we build, in order, checked off as it ships). Same convention as
`improvement-roadmap.md`: `[ ]` todo · `[x]` done · `~` deferred.

---

## Phase 0 — Compliance fixes (de-risk what's already live)

- [x] "Verified" copy: define at every use ("identity verified through
  our payments partner — not a background check"); soften "photo
  evidence built in" → "photo evidence tools on every rental"
  (market home, layout, world pages, store pages, PDP)
- [x] Late-fee disclosure on the PDP: exact formula (daily rate +
  $20/day, capped 3 days, 2h grace) before booking
- [x] Cost line-items on the awaiting-payment card: subtotal / tax /
  deposit hold (refundable) / total due today + "no renter platform
  fee" note
- [x] Overdue-flip pre-check: recheck pending/approved extensions +
  CAS guard in market-cleanup-holds before checked_out → overdue

## Phase 1 — Evidence ceremony (the locked flow)

- [x] Multi-photo evidence upload (evidence form: up to 6 photos per
  party per phase; shared prerequisite with Phase 3 listing photos)
- [x] Seller "before" photos BLOCKING on "Mark checked out" (count ≥2;
  serial/label prompt where risk family requires)
- [x] Renter pickup-photo window (≤4h post-checkout) + return-photo
  window (≤24h) with nag UI on My rentals
- [x] Dispute card: evidence checklist (which sets exist, timestamps,
  windows met?) + presumption rules rendered for the founder
- [x] No-seller-before-photos = deposit capture disabled in
  resolution form (enforced, not just convention)
- [x] Pre-booking disclosure of the ceremony on the PDP

## Phase 2 — Demand capture

- [x] Widen demand schema: `market_demand_requests` (or extend
  waitlist) — category, query, dates, zip, budget, delivery_required,
  notes, status new|matched|notified|closed
- [x] `had_results` flag on market_demand_events search logging
- [x] No-results search form + coming-soon category form + homepage
  "Can't find what you need?" CTA
- [x] Founder admin demand panel (requests by category/metro — the
  supply-acquisition to-do list)
- [x] Service-type requests logged too (photographer, DJ — feeds the
  operated-rentals decision)

## Phase 3 — Listing quality score

- [x] Multi-photo listing upload (up to 6; gallery on PDP)
- [x] `scoreListing()` compute-on-read engine (weights per sprint doc;
  photos component scales with real photo count)
- [x] Seller hub: score + top-3 suggestions per listing
- [x] Low-score warning on publish (not a block)

## Phase 4 — Trust badges

- [ ] `computeSellerBadges()` service (computed, never stored; short
  cache): fast_responder, photo_evidence_ready, delivery_available,
  korent_operator, completed_rentals (≥3), low_dispute_rate (<2%
  after ≥10)
- [ ] System/spam messages excluded from response math (day one)
- [ ] Badge surfaces: listing card, PDP, store page, checkout trust box
- [ ] Seller hub: live standing vs each criterion (eBay-style)
- [ ] ~ id_verified (needs seller-side verification provider)
- [ ] ~ contract_ready (lights up with Phase 6)

## Phase 5 — Delivery / setup (trimmed v1)

- [ ] Listing fields: delivery_base_fee_cents (round-trip flat),
  setup_fee_cents, teardown_fee_cents, delivery_min_subtotal_cents,
  free_delivery_radius_miles, max_delivery_radius_miles (+ seller
  profile defaults)
- [ ] Checkout: pickup vs delivery choice, address field, radius
  check (metro-based, no geocoding), all lines shown pre-payment
- [ ] Platform fee applies to delivery/setup; never deposits/taxes
- [ ] Booking/Hub/emails render delivery lines
- [ ] ~ per-mile, after-hours, rush fees (need geocoding /
  time-of-day pickup)

## Phase 6 — Risk-based contracts

- [ ] `lib/market/contracts.ts`: tier resolver (value bands +
  risk-family floors per sprint doc) + packet generator (full
  snapshot incl. line items, fees stated exactly as computed)
- [ ] Tables: market_contract_packets + market_contract_signatures
  (templates in code; events ride market_booking_events)
- [ ] Meyer-compliant assent screen (uncluttered, blue underlined
  link, "By clicking… you agree" on the button)
- [ ] e_sign tier: bilateral typed-name + SHA-256 hash + IP/UA/
  timestamp audit trail
- [ ] Payment gated on required contract step (instant book still
  reserves dates)
- [ ] Extensions void-and-regenerate as addendum packet
- [ ] $5k+ → founder review queue in admin (24h SLA)
- [ ] Lawyer pass on the generated template text (founder action)

## Phase 7 — Packages + operated rentals (Hosting & Events)

- [ ] market_listing_components (package → component listings, qty,
  required) — availability = min across components via EXISTING
  multi-item holds (no new inventory mode)
- [ ] market_listing_addons (reservable | non_reservable, price, qty)
- [ ] **Operated add-ons**: attendant/operator as a reservable add-on
  ("photo booth with attendant") — service rides the equipment,
  equipment anchors the transaction (BabyQuip/wet-hire model;
  standalone services marketplace explicitly deferred)
- [ ] Seller hub package builder (components + add-ons + price +
  delivery/setup required flag)
- [ ] Marketplace package card + PDP (components, add-ons, starting
  price)
- [ ] ~ multi-seller packages (never in v1)

## Phase 8 — Condition Proof (the Live Verify reshape)

- [ ] Required tier (≥$2,500 replacement, towable-road,
  high-value-electronics, zero-history seller + high value): seller
  uploads checklist-driven photos or short self-recorded video within
  the booking-response window
- [ ] Checklist templates in code per risk family (sprint doc lists)
- [ ] Tables: condition-proof requests + results (events ride
  market_booking_events)
- [ ] Serial/VIN checklist items unlock only after verified renter +
  active booking request
- [ ] Copy: "seller demonstrated" — never "Korent verified"
- [ ] Quality-score + badge hooks (condition proof provided)
- [ ] ~ optional live call (scheduling flow + provider abstraction —
  later; no recording v1)

---

## Done log

- **2026-06-13 — Phase 3 (listing quality score):** multi-photo listing
  upload (up to 6, ordered) — new `market_listing_photos` table
  (public-read for published listings, service-role writes, applied to
  prod); the create action uploads each photo to the public market-media
  bucket, mirrors the first to photo_url for back-compat, and inserts the
  gallery rows; PDP renders the cover + a thumbnail strip. Deterministic
  `scoreListing()` engine (pure, no table, unit-tested) weights photos 35
  (scales with real count, capped at 4), description 20, title 10, proof
  video 15 (required-aware), replacement value 10, pricing tiers 10 — all
  seller-controllable; condition/fulfillment intentionally unscored.
  Seller hub shows ⭐ score/100 per listing (green/amber/red) + top-3
  point-gain suggestions. Publish never blocks on score, but below 60 the
  success toast warns with the number. 6 new tests (489/489). tsc clean ·
  build green.
- **2026-06-13 — Phase 2 (demand capture):** market_demand_requests
  table (query/dates/zip/budget/delivery/email/notes/source/status,
  service-role-only, applied to prod) + result_count on
  market_demand_events; DemandRequestForm (compact query+email, expands
  to dates/budget/delivery) on no-results search, smoke-test world
  pages, and a homepage "looking for something we don't have?" CTA;
  search page fetches results first then logs result_count so
  zero-result searches are distinguishable; founder admin demand panel
  (open requests with full intent + status triage new→notified→matched
  →closed, plus top zero-result search terms over 30d); service
  requests (photographer/DJ) flow through the same free-text query —
  feeds the operated-rentals decision. tsc clean · 483/483 · build green.
- **2026-06-13 — Phase 1 (evidence ceremony):** multi-photo evidence
  upload (up to 6 per submit, one row each); seller before-photos
  BLOCKING at checkout (lifecycle gate: <2 seller handoff photos →
  "Mark checked out" refuses, alongside the existing identity gate);
  renter pickup/return forms carry the ≤4h/≤24h window copy as
  dispute-eligibility nudges; founder dispute card renders the evidence
  ladder (seller-before / renter-pickup / renter-return / seller-after
  with counts + timestamps) and the presumption rules; deposit-capture
  guard enforces "no seller baseline → no capture" in resolveDispute
  (refund/no-fault still allowed); PDP pre-booking disclosure of the
  photo ceremony. Pure summarizer extracted to evidence-summary.ts +
  4 unit tests (483/483). No migration — reuses market_handoff_evidence.
- **2026-06-12 — Phase 0 (compliance fixes):** "verified" copy made
  precise everywhere (card pill → "Local seller"; store badge earned —
  renders only on Stripe-KYC-complete sellers, retitled "ID-verified
  seller" with tooltip; hero/world/meta/footer copy → identity-verified
  / deposit-backed / evidence tools; PDP proof video → "seller-provided
  demo"; footer clarifier: not a background check, deposits aren't
  insurance), late-fee formula disclosed on the PDP from the actual
  code constants, awaiting-payment card gained rental/tax/due-today/
  deposit-hold lines + the no-renter-fee note, overdue flip now skips
  bookings with pending extension requests (Hertz rule).
