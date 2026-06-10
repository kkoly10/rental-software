# Multi-vertical launch readiness — fix plan

Tracks the work needed to make Korent ready to take real money
across all 6 verticals (inflatable, tents, tables-and-chairs,
dance-floors, photo-booths, concessions). Cross-checked against
the recon report at the end of this file.

Three PRs in sequence:

1. **PR-1 — "Take real money safely"** (🔴 hard launch-blockers)
2. **PR-2 — "Multi-vertical revenue health"** (🟡 big revenue / risk)
3. **PR-3 — "Vertical conversion polish"** (🟢 the Phase A-D plan)

## Coverage check

| Recon item | Verdict | PR | Notes |
|---|---|---|---|
| 1. Inventory / availability guard | ✅ works | — | `reserveProductAvailabilityBlock` with advisory-lock atomic insert; no fix needed |
| 2. Sales tax | ❌ never computed | PR-1 | Decision needed: flat per-org rate vs. per-jurisdiction vs. Stripe Tax |
| 3. Stripe refund flow | ⚠️ manual only | PR-1 | Wire `stripe.refunds.create` into cancel-order |
| 4. Damage waiver | ❌ missing | PR-2 | Opt-in 8–12% surcharge with capability gate |
| 5. Delivery fee — flat | ✅ works | — | Per-service-area flat fee; distance-based deferred to v1.1 |
| 6. Cancellation policy per vertical | ❌ missing | PR-2 | Per-vertical `refund_window_days` + `forfeit_pct` |
| 7. Lead-time validation | ⚠️ org-wide only | PR-2 | Add per-vertical override on top of global |
| 8. Setup/breakdown buffer | ⚠️ exists, not wired | PR-1 | Extend availability window calc |
| 9. Multi-vertical storefront | ✅ unified catalog | — | Single `/inventory` shows all verticals; no fix |
| 10. Saved card / damage charge | ❌ missing | PR-2 | New `payment_methods` table + `setup_future_usage` |
| 11. SaaS billing model | ✅ subscription | — | Marketplace / Stripe Connect explicitly deferred |
| 12. Storefront i18n | ⚠️ infra only | PR-3 | Add es/fr/pt translations + locale picker |
| 13. Per-unit quantity selector | ⚠️ URL only | PR-3 | Storefront PDP quantity stepper |
| 14. Per-category minimum | ⚠️ org-wide | PR-3 | Per-category override; falls back to service area |
| 15. Customer-initiated quote | ❌ operator-only | PR-3 | New "Request Quote" CTA → `order_status='inquiry'` |
| 16. Legacy terms backfill | ⚠️ 7 profiles | PR-3 | 4 RBAC fixtures backfilled; 3 real accounts get record-on-next-login |

**Explicitly NOT in this plan** — discussed and deferred:

- **Distance-based delivery fee** — needs Mapbox/Google Maps
  integration; flat per-zip works for launch markets. Revisit when
  an operator asks.
- **Stripe Connect / marketplace commission** — `stripe_subscription_*`
  columns confirm the subscription model is committed; Connect
  isn't relevant.
- **Per-event packages** (3hr/4hr photo booth) — `per_hour` pricing
  covers it for v1; revisit if operators ask.

## Decisions needed before coding

- [ ] **Tax strategy** (blocks PR-1 #1):
  - (a) Flat per-org rate — operator sets a single % in settings; applies to all orders. Fastest to ship.
  - (b) Per-jurisdiction lookup — table of state+county rates; uses delivery address ZIP. More correct, ~1 extra day.
  - (c) Stripe Tax integration — automatic, ~$0.50/transaction, requires Stripe account on every operator. Most correct, ~2 extra days.

---

## PR-1 — Take real money safely (target: ~3 days)

Goal: nothing about taking a customer payment can leave you with
hidden tax liability, an un-refundable cancellation, or a silently
double-booked crew.

### #1 Sales tax computation

- [x] Decide tax strategy — per-jurisdiction (state + optional postal_code override)
- [x] Schema change: `tax_rules` table with `(org, state, postal_code, rate_bps, label)` + RLS
- [x] `lib/checkout/tax.ts` — lookup helper, exact-match-wins precedence
- [x] `lib/checkout/actions.ts` — compute tax after subtotal + delivery_fee; populate `orders.tax_amount`; total = subtotal + fee + tax
- [x] `lib/data/checkout-pricing.ts` — preview tax on the review screen using service_area's state for ZIP-only lookups
- [x] Surface tax line on `components/checkout/checkout-summary-card.tsx`
- [x] Surface tax line on `components/checkout/checkout-form.tsx` review block
- [x] Surface tax line on order detail page + invoice PDF + quote PDF
- [x] i18n: `tax` key added to en/es/fr/pt
- [x] Backfill: leave existing 11 orders with `tax_amount=0` (historical)
- [x] Tests: 7-case unit suite for tax lookup precedence + rounding + state normalization
- [ ] Operator UI for managing `tax_rules` (deferred — operators can seed via DB / Supabase Studio for now; settings card lands in a follow-up)

### #2 Stripe refund integration

- [ ] Migration: `payments.stripe_refund_id text`, `payments.refund_reason text`
- [ ] `lib/portal/cancel-order.ts` — if order has a captured deposit, call `stripe.refunds.create({payment_intent, amount, reason})` and log to payments
- [ ] Operator action: "Refund deposit" button on order detail; partial-amount input + reason dropdown
- [ ] Webhook listener: handle `refund.created`, `refund.updated`, `refund.failed`
- [ ] Test: end-to-end cancel + refund spec asserts a Stripe refund object lands

### #3 Setup/breakdown buffer in availability check

- [ ] Migration: `products.breakdown_minutes_after integer`
- [ ] `lib/availability/window.ts` — extend window by `setup_minutes_before` + `breakdown_minutes_after`
- [ ] `lib/availability/check.ts` — use extended window when counting blocks
- [ ] `lib/availability/actions.ts:94` — when reserving, write the extended window into `availability_blocks.starts_at/ends_at`
- [ ] Operator UI: product form fields for setup + breakdown minutes
- [ ] Test: spec asserts a Sat 10am event with 4h setup blocks Fri 11pm
- [ ] Test: spec asserts a Sat 10pm event with 2h breakdown blocks Sun 12am

### PR-1 sign-off

- [ ] `npm test` green
- [ ] One full vertical walk green on preview (inflatable)
- [ ] Update `docs/qa/launch-readiness.md` with PR-1 status
- [ ] Open PR, request review

---

## PR-2 — Multi-vertical revenue health (target: ~3-4 days)

Goal: non-inflatable verticals stop bleeding revenue and don't
over-promise on cancellation terms they can't honor.

### #4 Damage waiver

- [ ] Migration: `products.damage_waiver_rate_bps integer` (basis points; null = not offered)
- [ ] New capability slug `pricing.damage-waiver` in `lib/capabilities/**`
- [ ] Vertical defaults in `lib/verticals/<v>.ts` registry (tents/dance-floors/inflatable: 10%, T&C/concessions: 0% by default)
- [ ] Checkout form: opt-in checkbox shown when product capability includes `pricing.damage-waiver`
- [ ] `lib/checkout/actions.ts` — add waiver line to subtotal calc; persist as order_item with `line_type='damage_waiver'`
- [ ] Receipt + invoice surfaces show the waiver line
- [ ] Test: spec asserts opt-in adds the line; opt-out does not

### #5 Saved-card / post-event damage charge

- [ ] Migration: `customers.stripe_customer_id text`, new table `payment_methods (id, customer_id, stripe_payment_method_id, card_brand, card_last4, card_exp_month, card_exp_year, is_default)`
- [ ] Checkout: pass `setup_future_usage='on_session'` and `customer={customer_id}` when creating Stripe payment intent
- [ ] Webhook: on `payment_method.attached`, write to `payment_methods`
- [ ] Operator UI: "Charge for damage" action on completed order — amount + reason + selects saved payment method
- [ ] Server action: `stripe.paymentIntents.create({customer, payment_method, off_session: true, confirm: true})`
- [ ] Test: end-to-end charge a saved card on a completed order

### #6 Per-vertical cancellation policy

- [ ] Add to `lib/verticals/<v>.ts` registry: `{refundWindowDays, forfeitPct}` — inflatable 1/0, T&C 3/0, dance-floors 7/50, tents 30/50, photo-booths 14/50, concessions 7/0
- [ ] `lib/portal/cancel-order.ts` — read vertical from order's primary product, compute refund amount, apply forfeit
- [ ] Operator settings: per-vertical override card
- [ ] Customer-facing T&C blurb on portal cancel page
- [ ] Test: spec walks a 30-day-out tent cancel (full refund) and 5-day-out (50% forfeit)

### #7 Per-vertical lead-time

- [ ] Add `minLeadTimeHours` to `lib/verticals/<v>.ts` registry
- [ ] `lib/checkout/actions.ts:893` — compute `effectiveLeadTime = max(orgLeadTime, verticalLeadTime, productLeadTime)`
- [ ] Storefront PDP: show "Earliest available: <date>" based on effective lead time
- [ ] Test: spec asserts a tent booking for tomorrow is rejected; for 3 weeks out is accepted

### PR-2 sign-off

- [ ] `npm test` green
- [ ] Walk each non-inflatable vertical on preview verifying new flows
- [ ] Update `docs/qa/launch-readiness.md` with PR-2 status
- [ ] Open PR

---

## PR-3 — Vertical conversion polish (target: ~3 days)

Goal: storefront stops blocking conversions on the verticals that
need quantity, multilingual access, or quote-first flow.

### #8 Storefront i18n

- [ ] Audit `messages/operator.<locale>.json` for reusable strings
- [ ] Create `messages/storefront.{es,fr,pt}.json` translations (es prioritized for US market)
- [ ] Locale picker component in storefront header (sets `NEXT_LOCALE` cookie)
- [ ] Walk: storefront PDP + checkout in `es` renders without English fallbacks
- [ ] Test: spec switches locale via picker and asserts PDP labels change

### #9 Per-unit quantity selector

- [ ] `<QuantityStepper>` component on PDP for products where `pricing_model='per_unit'`
- [ ] Wire selector value to checkout link's `?units=N` param
- [ ] Show subtotal preview ("$5 × 80 = $400") as user adjusts
- [ ] Test: spec adds 80 chairs and asserts checkout total

### #10 Per-category minimum

- [ ] Migration: `categories.minimum_order_amount numeric(10,2) null`
- [ ] `lib/checkout/actions.ts:858` — use category min when set, else fall back to service-area min
- [ ] Operator settings: per-category min field on category edit form
- [ ] Test: spec configures T&C category to $30 min, books a $40 chair order, asserts checkout succeeds

### #11 Customer-initiated quote path

- [ ] Storefront PDP secondary CTA gated by `theme_settings.ctaSecondary='request_quote'`
- [ ] New server action `requestQuote()` creates `order_status='inquiry'` with customer details
- [ ] Operator notification: new inquiry email/dashboard badge
- [ ] Reuse existing operator quote-send flow
- [ ] Test: spec triggers Request Quote on a tent product, asserts inquiry row + operator notification

### #12 Legacy terms backfill

- [ ] Migration: silent backfill for 4 RBAC test fixtures (`*@rbac-pwtest.invalid`) with `terms_accepted_at = created_at, terms_version = 'legacy'`
- [ ] Auth callback: for the 3 real accounts (komlankouhiko, comlan11, shehaba24), set `terms_accepted_at = now()` + IP on first login after deploy
- [ ] Test: query asserts 0 profiles with `terms_accepted_at IS NULL` after migration + first login simulation

### PR-3 sign-off

- [ ] `npm test` green
- [ ] Walk T&C and tents flows end-to-end
- [ ] Update `docs/qa/launch-readiness.md` with PR-3 status
- [ ] Open PR

---

## Background — recon findings that drove this plan

Full report in conversation history. Key DB-level findings:

- **0 of 11 historical orders carry tax** (`orders.tax_amount`). Column exists, never populated.
- **0 of 11 orders trigger an `availability_blocks` write** — but this is because they were dashboard-created, not storefront-created; the storefront DOES write blocks via `reserveProductAvailabilityBlock`.
- **`stripe_subscription_*` columns on organizations** confirm subscription-billing model, not marketplace commission.
- **No `damage_waiver_*`, `cancellation_policy`, `refund_window`, `breakdown_*`, or `payment_methods` columns exist** anywhere in the schema.
- **`products.setup_minutes_before` exists** but `lib/availability/window.ts` only checks `event_date → rental_end_date` — the setup buffer is ignored at conflict-check time.

The architecture is sound for ~70% of the rental-business surface
area; the gaps are concentrated in tax, payments-side completeness
(refunds / saved cards / damage waiver), and per-vertical policy
enforcement.
