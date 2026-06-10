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

- [x] Migration: `payments.stripe_refund_id text`, `payments.refund_reason text` + unique index
- [x] Operator action: `lib/payments/refund-actions.ts` — `issueStripeRefund` calls `stripe.refunds.create` against the captured deposit's payment_intent
- [x] Operator UI: `<RefundDepositButton>` two-step form (amount + required reason) on order detail
- [x] Webhook handler: `charge.refunded` now upgrades `pending` rows to `paid` instead of skipping (handles the operator-initiated flow's pending row)
- [x] Audit trail: `logAppEvent("stripe_refund_issued")` for the operator action, plus the Stripe metadata carries operator_note for QuickBooks/Xero export
- [x] Type check + 369 unit tests green
- [ ] Portal-initiated auto-refund on cancel (deferred to PR-2 — depends on per-vertical cancellation policy)

### #3 Setup/breakdown buffer in availability check

- [x] Migration: `products.breakdown_minutes_after integer` with nonneg constraint
- [x] `lib/availability/window.ts` — extend window by `setup_minutes_before` + `breakdown_minutes_after`; preserved original behavior when args omitted
- [x] `lib/availability/check.ts` — fetch product's setup/breakdown, pass through; conflict check now uses the extended window
- [x] `lib/availability/blocks.ts` — reserve writes the extended window into `availability_blocks.starts_at/ends_at`
- [x] Operator UI: product form `<SetupWindowField>` now has both setup + breakdown inputs with vertical-specific guidance
- [x] Validation: `breakdownMinutesAfter` in `lib/validation/products.ts` zod shape, 0-24h bounds
- [x] Persistence wired through `lib/products/actions.ts` (create + update paths)
- [x] 9-test unit suite pins the buffer math: setup before, breakdown after, midnight-crossing, multi-day, negative-clamp, no-buffer fallback
- [x] Full suite green (378/378)

### PR-1 sign-off

- [x] `npm test` green (378/378, +16 new tests across PR-1)
- [x] `npx tsc --noEmit` clean
- [ ] One full vertical walk green on preview (inflatable) — pending preview deploy
- [ ] Update `docs/qa/launch-readiness.md` with PR-1 status
- [ ] Open PR, request review

---

## PR-2 — Stripe Connect Express (decision: Option A)

Re-scoped 2026-06-10: the user chose Connect Express for operator
payments (subscription-only, no per-booking platform fee — see the
decision record in `docs/marketplace/master-plan.md`). Direct
charges: payments, refunds, and disputes live on the operator's
connected account; Korent is never in the funds flow. The original
PR-2 scope moves to PR-2b below; saved-card explicitly DEPENDS on
Connect landing first (cards must be saved on the connected
account's Customers, not the platform's).

### Connect Express integration

- [x] Migration: `organizations.stripe_connect_account_id` + `charges_enabled` / `payouts_enabled` / `details_submitted` mirrors + `onboarded_at`, unique index on acct id
- [x] `lib/stripe/connect.ts` — pure status state machine (`not_connected → onboarding_incomplete → pending_verification → ready`) shared by card, banner, and checkout gate
- [x] `lib/stripe/connect-actions.ts` — owner/admin-gated onboarding start (account create + account link), Express dashboard login link, manual status refresh
- [x] `/api/stripe/connect/return` — syncs account state from Stripe on onboarding return
- [x] `/api/stripe/connect/refresh` — mints a fresh account link when the old one expires
- [x] Webhook: `account.updated` mirrors verification state onto the org (metadata org-id lookup with acct-id spoof guard + fallback)
- [x] Checkout: deposits now created as DIRECT charges (`{stripeAccount}`); online payment gated on `charges_enabled`, falls back to deposit-due-on-delivery until onboarding completes
- [x] Refund action: issues on the connected account with platform fallback for pre-Connect payments (`resource_missing` retry)
- [x] Readiness banner: warns until Connect is ready, links to Settings → Billing
- [x] Settings → Billing: Connect status card (4 states) + onboarding/resume/check-status/dashboard buttons, i18n'd en/es/fr/pt
- [x] 9-test unit suite pins the status mapping; full suite 387/387
- [ ] **Deployment config (manual)**: Stripe webhook endpoint must enable "listen to events on connected accounts" (direct-charge events arrive with `event.account`); verify `account.updated` is in the subscribed events

## PR-2b — Multi-vertical revenue health (target: ~3-4 days)

Goal: non-inflatable verticals stop bleeding revenue and don't
over-promise on cancellation terms they can't honor.

### #4 Damage waiver ✅ (landed in PR-2c)

- [x] Migration: `products.damage_waiver_rate_bps integer` (0–5000 bps; null = not offered)
- [x] Operator product form gains a "Damage waiver" details panel; rate entered as % and stored as bps
- [x] `lib/checkout/damage-waiver.ts` — pure cents-safe calculator with 8-test unit suite (clamps, rounding, not-offered, not-accepted)
- [x] Checkout reads `damage_waiver` form field; adds the surcharge to subtotal AFTER wet-upcharge AND BEFORE delivery+tax (waiver applies to rental subtotal only)
- [x] Persists as `order_items` child with `line_type='damage_waiver'`; parent_order_item_id ties it to the rental
- [ ] Storefront PDP / checkout UI to opt in (deferred to PR-3 — operator product form field shipped here; the customer-facing checkbox lands with i18n in PR-3)

### #5 Saved-card / post-event damage charge ✅ (landed in PR-2c)

- [x] Migration: `customers.stripe_customer_id`, new `payment_methods` table (org-scoped, RLS, unique on `stripe_payment_method_id`)
- [x] Checkout creates / reuses a connected-account Stripe Customer for the renter; checkout session passes `customer` + `payment_intent_data.setup_future_usage='on_session'` so the card attaches for off-session reuse
- [x] Webhook `payment_method.attached` mirrors the card metadata (brand, last4, exp) onto `payment_methods` with 23505 dedup
- [x] `lib/payments/damage-charge-actions.ts` — operator action calls `stripe.paymentIntents.create({off_session: true, confirm: true})` scoped to the connected account; records as `payment_type='damage_charge'`; surfaces SCA authentication_required as a friendly message ("send an invoice link instead")
- [ ] Operator UI button "Charge for damage" on the order detail (action exists; thin form binding deferred to PR-3 alongside the customer-facing waiver checkbox so both ship together)

### #6 Per-vertical cancellation policy ✅ (landed in PR-2b)

- [x] `VerticalPolicies` on the registry: `{refundWindowDays, forfeitPct, minLeadTimeHours}` — inflatable 1/0/24h, T&C 3/0/48h, dance-floors 7/50/72h, tents 30/50/504h, photo-booths 14/50/72h, concessions 7/0/48h
- [x] `lib/verticals/policies.ts` — pure outcome calculator (cents-safe; refund+forfeit always equals deposit; permissive fallback for unknown verticals)
- [x] `lib/portal/cancel-order.ts` — resolves vertical via order item → product → category, computes the outcome, AUTO-REFUNDS the computed amount via the shared refund core, customer message states refund/forfeit explicitly; failures never un-cancel (operator falls back to the manual button)
- [x] `lib/payments/refund-core.ts` — extracted shared Stripe refund engine (Connect routing + ledger insert) used by both the operator button and portal cancel. **Fixed latent PR-1 bug**: deposit lookup filtered `payment_status='succeeded'` but the codebase convention is `'paid'` — the operator refund button would have always said "No Stripe deposit found"
- [x] 11-test unit suite pins window boundaries, forfeit math, clamps
- [ ] Operator settings: per-vertical override card (deferred — registry defaults for launch)
- [ ] Customer-facing policy blurb on PDP/checkout (deferred to PR-3 polish)
- [ ] Test: spec walks a 30-day-out tent cancel (full refund) and 5-day-out (50% forfeit)

### #7 Per-vertical lead-time ✅ (landed in PR-2b)

- [x] `minLeadTimeHours` in the registry (see #6 values)
- [x] `lib/checkout/actions.ts` — effective lead time = max(org policy, vertical floor); vertical resolved via the product's category embed; day-denominated error copy for ≥48h floors
- [x] Unit tests cover the max() semantics
- [ ] Storefront PDP "Earliest available: <date>" hint (deferred to PR-3 polish)

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

### #12 Legacy terms backfill ✅ (landed in PR-3a)

- [x] Migration `20260610_080000_legacy_terms_backfill_rbac_fixtures.sql` backfilled the 4 RBAC fixtures (`*@rbac-pwtest.invalid`) with `terms_accepted_at = created_at, terms_version = 'legacy'`; applied to prod
- [x] `lib/auth/actions.ts:signInWithPassword` — record-on-next-login shim: stamps `terms_accepted_at = now()` + IP + version when the column is still NULL at sign-in time; idempotent for everyone else via `.is("terms_accepted_at", null)`
- [x] Audit query post-migration: `null_profiles=3` → the 3 real accounts that will stamp at their next sign-in (komlankouhiko, comlan11, shehaba24)

### #13 Operator UI gating polish ✅ (landed in PR-3a)

- [x] `lib/verticals/suggested-capabilities.ts` — reuses each vertical's existing `capabilities` array as its suggested-by-default set (single source of truth)
- [x] Product form CapabilityCheckboxes splits each capability group into "Suggested for &lt;vertical&gt;" + "Show advanced" expander; new products default-check the suggested set
- [x] Closes the audit's UX concern: a bouncer operator doesn't have to scroll past damage waiver / attendant hours to find anchoring; a chair operator never sees inflatable-specific capabilities by default

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
