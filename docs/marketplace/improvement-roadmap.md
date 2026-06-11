# Marketplace Improvement Roadmap

**Created:** 2026-06-11 · **Owner:** founder + Claude · **Status:** in progress

This is the working tracker for the six gaps found in the master-plan
audit (2026-06-11), upgraded with competitive research. Check items
off as they ship; every workstream lists *why it exists*, *what the
research changed*, and *the build checklist*.

**Why this document exists:** the marketplace core (deposits, holds,
booking lifecycle, payments/tax, evidence, disputes, moderation,
store pages, Seller Hub) is built and live. The audit found six
master-plan capabilities still missing — several of which decide
whether first-time sellers and renters succeed. We are opening the
door to people who have never rented anything out before; each item
below removes a place where a "noob" gets stuck or the platform
leaks money/trust.

**Build order:** 1 → 2 → 3 → 4 → 5 → 6 (waves: 1–3 together, then 4, 5, 6).

Legend: `[ ]` todo · `[x]` done · `~` deliberately deferred

---

## 1. Seller KYC → bookability gate (master plan §12)

**Why:** the plan is explicit — *"No listing accepts bookings until
the seller can actually be paid."* Today a seller can publish and
accept a request with zero Stripe payout setup, which is why the Pay
button silently no-ops (e2e finding). Renter money must never be
taken for an unpayable seller.

**Research (sources in PR threads):**
- Stripe: gate on `charges_enabled && details_submitted`, not
  `details_submitted` alone (form-finished ≠ verified). Inspect
  `requirements.currently_due`; collect `eventually_due` upfront.
- Recompute the local flag on every `account.updated` webhook —
  Stripe can revoke `charges_enabled` later (volume-threshold
  re-verification). Re-check at checkout as belt-and-braces.
- Sharetribe reference pattern: listings stay **visible but not
  bookable** (supply/SEO preserved); booking CTA replaced with
  "seller is completing payout setup."
- Account Links are single-use and expire in minutes — mint fresh
  server-side on every click; never store them.
- Distinguish `platform_paused` from Stripe-initiated restriction in
  seller messaging.

**Checklist:**
- [x] `payouts_ready` (derived: charges_enabled && details_submitted) persisted on the seller's Connect record
- [x] `account.updated` webhook recomputes the flag (+ auto-pause when it drops)
- [x] Listing pages: booking form replaced with "completing payout setup" notice when not ready
- [x] Booking/instant-book actions re-check the flag server-side (reject with friendly message)
- [x] Seller Hub: "X of 3 steps to go live" checklist (store page · payout setup · first listing) with fresh onboarding link
- [x] Pay-button silent no-op replaced with an explanatory state (closes the e2e finding)

## 2. Seller pricing calculator (master plan §8, launch slice)

**Why:** a first-time seller with a $400 ladder has no idea whether
to charge $5 or $50/day. The blank price field is the scariest step
of the listing funnel; pricing guidance is a core managed-marketplace
function (a16z) and the master plan specifies the exact bands.

**Research:**
- Plan bands validated: ShareGrid publicly advises **3–5% of purchase
  price per day**; B2B equipment norms 1–2%/day; weekly ≈ 3× daily;
  monthly ≈ 3× weekly.
- **The Airbnb lesson:** silent auto-pricing anchors sellers low
  ("race to the bottom" criticism of Smart Pricing). Therefore:
  *suggest with bounds, editable default, never auto-set*; explain
  the math (Turo publishes its pricing logic to build trust).
- Charm-round suggestions ($39 > $40; left-digit effect).
- Frame earnings, not just price: payout/day after fees +
  "≈N rental days to recover your $X."
- Confidence labeling: "based on category guidelines" until real
  benchmark/booking data exists (§11 pipeline is post-launch).

**Checklist:**
- [x] `lib/market/pricing.ts` — deterministic engine: (risk family, replacement value, age, condition) → low/recommended/premium daily band + weekend/weekly suggestions + payout after fee + recover-cost estimate (unit-tested)
- [x] Live suggestion panel in the create-listing form (appears once category + replacement value are set)
- [x] One-tap "use suggested" fills daily/weekend/weekly fields (seller can override)
- [x] Deterministic explanation line + pre-benchmark confidence label
- [ ] ~ Benchmark library + comps-based anchors (§11 — post-launch, once listing density exists)
- [ ] ~ Auto-pricing mode (explicitly deferred; the research says don't)

## 3. Pickup/return reminders (master plan §24)

**Why:** the comms matrix requires time-based pickup and return
reminders; today emails fire only on state changes. Return reminders
directly reduce the overdue/late-fee path — the worst renter
experience we have.

**Research:**
- Turo: return reminder ~24h before trip end + near end; 30-min grace.
- Service-business cadence: email day-before (detail-heavy), short
  nudge at the time-critical moment; SMS excels there but email-only
  is fine for v1 (10DLC already registered when we want SMS).
- NN/g: transactional reminders are tolerated because they're
  expected — keep them strictly event-tied.

**Checklist:**
- [x] Reminder cron (hourly): day-before-pickup email (logistics + "bring your verified ID")
- [x] Morning-of-return email
- [x] Grace-expiry nudge (aligned with the 2h grace before `overdue`)
- [x] Sent-flags on bookings so reminders are exactly-once (`reminder_*_sent_at`)
- [x] Extension approvals reschedule the return reminder (see §4)
- [ ] ~ SMS channel for the time-critical nudges (post-launch)

## 4. Extension requests (master plan §18/§19)

**Why:** "can I keep it one more day?" is the most common mid-rental
event; without a flow it happens off-platform or becomes a late fee
and a dispute.

**Research:**
- Turo: request any time (even ≤24h after end — approval retroactively
  un-lates the renter); host gets ~12h to respond; lapse = original
  terms stand; **charged at approval** on the saved card.
- Getaround: **instant extensions** when instant-book + no conflict;
  30-day cap.
- Home Depot/United: extensions are continued billing at rental
  rates, not punitive — and opaque late math gets you sued
  (Home Depot class action).

**Decisions:**
- Auto-approve iff listing is instant-book AND no conflicting
  hold/booking within window + recovery buffer; else 12h seller
  approval window, lapse = declined.
- Price preview before submit; charge off-session at approval
  (customer + payment method already saved at booking payment).
- Pending request suppresses late-fee accrual; approval retroactively
  clears "overdue" if applicable.
- Cap: 30 days per extension. Deposit hold unchanged (same item);
  re-auth cron already manages hold freshness.

**Checklist:**
- [x] `market_extension_requests` table (booking, new end, price snapshot, state) + migration
- [x] Renter request UI on active rentals (price preview)
- [x] Seller approve/decline in Hub + 12h auto-lapse (cron)
- [x] No-conflict auto-approve path for instant-book listings
- [x] Off-session charge at approval (idempotency key per request)
- [x] Late-fee suppression while pending; retroactive un-late on approval
- [x] Emails: requested (→seller), approved/declined (→renter)

## 5. Same-seller multi-item bookings (master plan §13)

**Why:** the plan's own rationale — hosting-and-events renters need
tent + tables + chairs together; today that's three checkouts, three
deposits, three approvals.

**Research (simplified the design):**
- **Nobody supports partial accepts** (2-of-3); counter-offers happen
  via messages/quote edits (ShareGrid, Goodshuffle).
- Industry deposits are **order-level**, not summed per item
  (Booqable %-of-order, Goodshuffle waiver, Fat Llama per-request cap).
- Sharetribe explicitly advises rental marketplaces to skip carts;
  Etsy/eBay group carts by seller into per-seller orders anyway.
- ShareGrid packages: one agreement, one insurance policy across
  items in a rental.

**Decisions:** no cart — "Add more from this seller" on the request
form; one booking with line items; all-or-nothing atomic hold across
items (single advisory-lock transaction); whole-booking accept or
decline; one risk-based deposit on summed replacement value; one
payment; booking-level dispute with item-level evidence.

**Checklist:**
- [x] `market_booking_items` child table + migration (booking keeps money totals)
- [x] Multi-listing atomic reserve (extend `market_reserve_hold` to item sets)
- [x] "Add more from this seller" on the listing/request form
- [x] Deposit engine recompute on summed replacement value
- [x] Hub + rentals surfaces render line items
- [x] Evidence/disputes: booking-level case, per-item notes

## 6. Standby queue (master plan §10)

**Why:** "unavailable" renters currently bounce; the table exists
with no writer (bug-doc #30). Research found **no P2P rental platform
offers per-listing availability alerts** — this is a differentiator,
not parity.

**Research:**
- Resy/OpenTable broadcast races frustrate at small scale (losers,
  checkout race conditions).
- Hotels use sequential acceptance with fixed claim windows.
- Recommended: **sequential offer + 2–4h claim TTL** with a hard hold
  on the dates during the window; cascade on expiry; broadcast
  fallback when pickup is <48h away.

**Checklist:**
- [ ] "Notify me if it frees up" on unavailable date selections (writes `market_reservation_standby`)
- [ ] Cancellation/expiry hook: offer to next waiter + TTL hold
- [ ] Offer email with claim link; cascade on expiry (cron)
- [ ] Broadcast fallback inside 48h of pickup
- [ ] Promotion → normal request/checkout flow

---

## Done log

- **2026-06-11 — Wave 1 (items 1–3):** KYC-bookable gate (flags read at
  decision time from the webhook-synced org columns; PDP notice;
  request-action guard; Pay no-op fixed with renter banner; go-live
  checklist + Stripe onboarding button in the Hub), seller pricing
  calculator (engine + 6 tests, live panel, one-tap fill, weekend/
  weekly listing fields added end-to-end), reminder cron (pickup
  day-before / return morning-of / grace nudge, exactly-once flags,
  migration applied to prod).
- **2026-06-11 — Item 4 (extensions):** market_extension_requests
  (migration applied to prod), renter "Keep it longer" form with live
  estimate, Hub approve-&-charge / decline panel, instant-book
  auto-approve with conflict check, off-session destination charge at
  approval (idempotent), late-fee suppression while pending +
  retroactive un-late, return reminders re-armed on the new end date,
  12h lapse processing in the reminders cron, 4 new email kinds.
- **2026-06-11 — Item 5 (multi-item bookings):** market_booking_items
  + market_reserve_holds_multi RPC (all-or-nothing, deadlock-free
  sorted locks; capacity now counts secondary-item rows — migration
  applied to prod), "Add more from this seller" picker on the PDP
  (≤4 extras, same org enforced), combined rate-honoring subtotal,
  order-level risk-based deposit on summed replacement value, holds
  confirmed/released/stretched across every line item (payment,
  cancel, completion, extensions), line items rendered on My rentals
  and the Seller Hub.
