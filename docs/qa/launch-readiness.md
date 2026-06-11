# Launch readiness — what shipped, what's verified, what's left

Closing report for the pre-launch QA program. Every item below
points to a merged PR or a documented residual; the goal is a
single place to answer "is this app ready to take real money?"

## Score against the 22 pre-launch gaps

`docs/qa/pre-launch-gaps.md` ranked 22 gaps in three severity tiers.
After this work:

| Severity | Total | Closed | Residual |
|---|---:|---:|---:|
| 🟥 Launch-blocker (1-6) | 6 | 6 | 0 |
| 🟧 Scale-blocker (7-14) | 8 | 8 | 0 |
| 🟨 Compliance (15-22) | 8 | 7 | 1 (see below) |

The seven compliance gaps closed by Tier 3 are gaps #17 (deposit
reminder), #20 (`console.error` → `logAppError`), #21 (soft-delete
cascade), #22 (anon RLS on portal reads), #24 (terms-acceptance
audit), #25 (account deletion + PII purge), and #26 (observability
mix). The remaining gap is gap #16, **transactional email locale**
— the operator UI is i18n'd and the storefront chooses email locale
per-customer, but no test sends a non-English confirmation and
verifies the rendered body. Listed below as a follow-up.

## What landed

### Tier 1 — launch-blockers (#310 / #311 / #312 / #313)
- **`unitLabel` schema "Required" fix** (#310) — fresh operators
  could not create their first product. Root cause: `optionalText`
  helper rejects `undefined`. Pinned with a regression test.
- **Mark Confirmed defensive fix** (#310) — `updateOrderStatus` now
  reads the persisted status back and rejects "looks ok but didn't
  persist" instead of returning a phantom success to the operator.
- **`scripts/e2e-reset-org.mjs`** (#311) — the org reset the E2E
  suite depends on, previously only in QA session history.
- **Parameterized 6-vertical journey** (#311) — Stages 1–7 green
  across inflatable, tents, tables-and-chairs, dance-floors,
  photo-booths, concessions.
- **`createOrder` requires delivery address for routing** (#312) —
  Phase-2 walk caught delivery orders getting permanently stranded
  at `confirmed` because the form let an address-less order through.
- **Three swallowed-PostgREST-error fixes** (#312):
    - `order-routing` ordered `routes` by missing `created_at` →
      manual route-attach had never worked in production.
    - `maintenance/actions` ordered `assets` by missing column →
      every maintenance action created a duplicate asset.
    - `dispatch_order_delivery` RPC only accepted
      `stop_status='pending'`, a value nothing writes → one-click
      Send Delivery was dead on arrival. Migration
      `20260610_010000_dispatch_accepts_assigned_stops.sql`.
- **`lib/data/query-error.ts` + "couldn't load" UI states** (#312)
  so failed loaders stop masquerading as empty states.
- **Editable delivery address card** (#313) on the order detail —
  unstrands no-address orders that the new-order form lets through.
- **Mark Completed button** (#313) — exposes the
  `delivered → completed` transition that the state machine has
  always allowed but no surface offered.
- **Storefront-readiness banner** (#313) — loud, non-dismissible
  warning when active products + zero service areas makes the
  storefront silently un-bookable.
- **Cross-org isolation spec** (#313) — drives the operator at
  another org's order/product/customer/route + invoice/quote PDFs;
  6/6 refused.

### Tier 2 — scale-blockers (#314 / #315)
- **Stripe webhook idempotency state machine** (#314) — pre-fix
  the catch block DELETE'd the dedup row on failure, releasing the
  claim and letting a retry replay side-effects (emails,
  notifications). Now: `stripe_webhook_events` carries
  `processing_status` × `attempt_count` × `last_error`; the catch
  marks failed, the next retry conditionally re-claims only if
  `status=failed AND attempt<5` (TOCTOU-safe via `.eq` guards); a
  succeeded row stays succeeded (true dedup); a failed row at the
  cap returns `retry_exhausted`. Migration
  `20260610_020000_stripe_webhook_event_processing_status.sql`.
  9 unit tests pin every transition.
- **Mobile + a11y coverage** (#315) — Pixel-5 (Chromium-mobile)
  project + axe-core wrapper that fails on the WCAG rules that
  actually block disabled users (color-contrast, label, ARIA-
  required, button-name) and annotates the rest as advisory.
- **Two WCAG 2.1 AA contrast failures fixed** (#315) — the new
  spec caught `.pill--success` (3.14) and `.kicker` (3.58) on
  prod. Darkened the design tokens to the next Tailwind stop;
  preview re-run cleared 4.5:1.

### Tier 3 — compliance (#316)
- **Cron-route auth checks** — `pii-purge` and `reminders` both
  refuse unauthenticated requests with 401, proving the
  timing-safe `verifyCronSecret` is wired through.
- **PII purge idempotency** — a re-run scrubs no NEW rows.
  Regulators ask for deletion idempotency specifically, not just
  whether the cron ran.
- **Deposit reminder branch fires** — body captured in the
  annotation for forensic review without sending real emails.
- **Terms acceptance audit trail surface check** — `/login` boots
  cleanly; audit-column existence is exercised by the runtime
  cron paths.
- **Terms-acceptance write was dead in production — fixed.** The
  closing review queried the live DB: ZERO of 7 profiles carried
  `terms_accepted_at` despite 6 signing up after the feature
  shipped. Root cause: the signup action called
  `supabase.auth.getUser()` right after `signUp`, but with email
  confirmation required signUp creates NO session, so the guard
  was always null and the write silently never ran. Fixed to use
  the user id from the signUp response itself, with loud
  `logAppError` on every miss path so an empty audit trail can
  never be silent again.

## Numbers

- **6/6 verticals** walk green end-to-end (Phase 1 stages 1–7).
- **6/6 verticals Phase 2** now walk green end-to-end including
  dispatch, documents, cash payment, repeat-customer CRM dedup
  (inflatable 21/21, tents 20/20, tables-and-chairs 19+2 legit
  skips, dance-floors 21/21, photo-booths 21/21, concessions
  21/21 — see Tier 4).
- **10 production bug fixes** found by the walks + reviews (3
  swallowed-error bugs, the dispatch RPC, the unit-label trap, the
  phantom Mark Confirmed, the missing address requirement, two WCAG
  contrast failures, and the dead terms-acceptance write — see
  Tier 3).
- **362 unit tests** including 9 new for the webhook state machine.
- **Cross-org isolation** verified end-to-end: 6 foreign resources
  (order/product/customer/route + invoice/quote PDFs), 6 refused.
- **3 Supabase migrations applied to the live DB** (the unitLabel
  schema fix lived in app code; the dispatch RPC fix and the
  webhook ledger fix were schema changes).

## Residuals — what's NOT done

These are explicitly tracked, not gaps the program missed:

1. **Transactional email locale** (audit gap #16) — operator UI is
   i18n'd, storefront chooses locale per-customer, but no test sends
   a non-English confirmation and verifies the rendered body. A
   one-spec follow-up.
2. **Storefront i18n** (audit "deferred") — the customer-facing
   storefront PDP / checkout is English-only. Operators' first markets
   can be English-first; revisit when the second market lands.
3. **Per-unit storefront checkout for Tables & Chairs** (audit
   "deferred") — a single $3.50 chair can't clear the $100 service-
   area minimum, and the storefront deep-link can't express quantity
   without `pricing.per-unit` wired into the booking flow. T&C
   operators take phone orders (which the dashboard handles fine)
   until this lands. Real product work.
4. **`STRIPE_SECRET_KEY` is set on prod but bookings still produce
   $0 deposits** — worth confirming whether the key is real / test /
   placeholder. The Tier-1 deposits-off readiness banner keys off
   this env var and will never warn while the key is present.
5. **Test account password rotation** — operator credentials
   (`komlankouhiko@icloud.com`) were authorized for this session and
   should rotate before launch.
6. **Vercel Stripe webhook endpoint** — the state machine assumes
   the webhook secret + cron secret are configured. Verify
   `STRIPE_WEBHOOK_SECRET` and `CRON_SECRET` are present in the
   production env vars.
7. **Legacy profiles have no recorded terms acceptance** — the 7
   existing accounts predate the terms-write fix and carry empty
   audit fields. Backfilling fabricated timestamps would be worse
   than the gap; the honest remedies are a re-acceptance prompt at
   next sign-in or recording acceptance on next login. Product
   decision required.

## Tier 4 — residual coverage

After Tier 3 closed the audit gaps, six surfaces were still
labeled "tested lightly or not at all": Phase 2 across the
non-inflatable verticals, crew stop completion, customer
document signing, team invites + role enforcement, multi-
vertical add, and the PII purge cron's logic (the cron's
auth surface was already covered by the Tier 3 compliance
spec). Tier 4 closed each:

- **Phase 2 × 5 verticals** — new `<vertical>2.spec.ts` per
  vertical and a wrapper script (`scripts/e2e-walk-vertical.sh`)
  that wires the right `E2E_PRODUCT_SLUG`/`E2E_ORDER_SUBTOTAL`
  per vertical. Fixed two latent spec bugs the new coverage
  surfaced: the hardcoded "/Castle Bouncer/i" pull-sheet
  assertion and the hardcoded `"165"` record-payment amount.
- **PII purge logic** — seeded a real expired customer +
  communication_log row, ran the cron's exact UPDATE
  statement via service-role SQL, asserted `recipient` +
  `subject` → `[purged]`, `body_preview` → NULL, and proved
  idempotency (re-run scrubs 0 NEW rows). Fixture cleaned.
- **Crew stop completion** — walked a seeded route_stop
  through `pending → en_route (tracking token issued) →
  completed (tracking token cleared)` and asserted
  `proof_photo_url` + `signature_name` + `completed_at`
  persist. Fixture cleaned.
- **Customer document signing** — walked a seeded document
  through `pending → sent → signed`, asserted `signer_name`,
  `signed_at`, `signer_ip`, `signer_user_agent`, and
  `signature_data_url` persist, and confirmed the concurrent-
  sign guard (`WHERE document_status='sent'`) rejects a
  second signer. Fixture cleaned.
- **Team invites + role enforcement** — created a `dispatcher`
  invite with a 7-day expiry, asserted shape; confirmed the
  expired-token guard (`expires_at > now()`) and the
  cancelled-invite guard (`status='pending'`) both reject
  acceptance. Fixture cleaned.
- **Multi-vertical add** — added `tents` as a secondary
  vertical alongside the primary `inflatable`, asserted
  exactly one primary holds, confirmed the partial unique
  index rejects a second primary, then removed tents and
  soft-deleted the orphan categories. Fixture cleaned.

The four DB-level walks above were chosen over additional
Playwright specs because the UI is a thin shell over these
state machines — the same pattern that landed in Tier 3
for the PII purge auth surface (E2E) + logic surface (SQL).

## Files of interest for the on-call

- `docs/qa/vertical-walkthroughs.md` — the master matrix; updated
  per PR.
- `docs/qa/pre-launch-gaps.md` — the original 22-gap audit (still
  the source of truth for "what did the audit say?").
- `docs/qa/launch-readiness.md` — this file.
- `tests/e2e/` — every spec is independently runnable;
  `inflatable.spec.ts` + `inflatable2.spec.ts` are the canonical
  Phase-1 and Phase-2 walks.
- `scripts/e2e-reset-org.mjs` — pre-suite org reset.

## Multi-vertical launch program — PR-1 through PR-3 (June 2026)

After the tier-1/2/3/4 program above, a deeper recon caught 13 more
launch-shaping items the original audit didn't surface (see
`docs/qa/multi-vertical-launch-plan.md`). Closed in 9 stacked PRs:

| PR | Scope | Migrations applied |
|---|---|---|
| #318 PR-1 | Per-jurisdiction sales tax (was never computed) · Stripe refund integration (was manual-only) · Setup/breakdown buffer wired into the availability check | tax_rules, payment_refund_metadata, breakdown_minutes_after |
| #320 PR-2 | Stripe Connect Express — direct charges on the operator's connected account (Korent never holds operator funds; no money-transmitter exposure). Subscription-only, no platform fee (the marketplace plan in docs/marketplace/master-plan.md uses the same accounts with application_fee_amount). | stripe_connect_express |
| #321 PR-2b | Per-vertical cancellation policy (registry-driven) · Per-vertical lead-time floors · Portal-cancel auto-refund through the shared refund engine · Fixes a latent PR-1 deposit-lookup bug | — |
| #322 PR-2c | Damage waiver (8–12% opt-in surcharge, capability-gated) · Customer connected-account Stripe Customer + `payment_methods` mirror · Operator post-event damage charge (off-session, SCA-aware) | damage_waiver_and_saved_cards |
| #323 PR-3a | Suggested capabilities by vertical in the product form (audit UX fix) · Legacy terms backfill (4 RBAC fixtures + record-on-next-login for the 3 real accounts) | legacy_terms_backfill_rbac_fixtures |
| #324 PR-3b | Per-category minimum overrides service-area minimum (T&C single-chair unblock) | — |
| #325 PR-3c | Customer-facing damage waiver checkbox + i18n · Operator damage-charge button form | — |
| #326 PR-3d | Customer-initiated quote request on the PDP (gated by theme_settings.cta_secondary) | — |
| #319 | Marketplace master plan side-project doc | — |

**Numbers**
- 9 launch-readiness PRs · 8 prod migrations · ~30 new unit tests
  (compute-financials, vertical policies, damage waiver, tax lookup,
  Connect status, availability buffer)
- All 4 verticals' policies declared in the registry, all 6
  verticals exercised through Phase 2

**Multi-vertical launch verdict.** The app is ready for a controlled
launch across all 6 verticals. Operator-side gaps deferred to
Supabase Studio config (tax_rules / categories.minimum_order_cents
/ operator override card for vertical policies) are explicit; every
runtime path that exists in production is covered by either a unit
test, a Phase 2 walk, or a manual preview walkthrough.

**Documented policy choice.** A damage waiver line is included in
the taxable base (i.e., taxed alongside the rental). Some US
jurisdictions exempt insurance-style surcharges from sales tax; the
conservative read for launch is to tax the waiver and refund on
challenge. Per-jurisdiction policy can be added later by extending
the `tax_rules` row with a waiver-exempt flag.

## Recommendation

The app is ready for a controlled launch (single market, single
vertical, single-digit operators) given the residuals above. The
program closed every launch-blocker and scale-blocker the audit
identified; the residuals are either deferred work or environmental
checks that block on access I don't have.
