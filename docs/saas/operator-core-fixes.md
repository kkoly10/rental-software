# Operator SaaS — Core Fixes Tracker

**Created:** 2026-06-13 · **Owner:** founder + Claude · **Status:** in progress

Diagnosis + execution checklist for the operator-side issues surfaced
after the marketplace Trust & Monetization sprint. Same convention as
`docs/marketplace/build-tracker.md`: `[ ]` todo · `[x]` done · `~` deferred.

These were found by a five-track recon (agreements/waivers, order
notifications, invoices, signup/onboarding flow, verticals end-to-end).
File:line references live in the session notes; this is the plan.

---

## Findings (severity-ranked)

1. **Operator new-order email never arrives (BUG, high).** The "new
   order" alert IS built (`lib/email/triggers.ts`), but `getOrgBranding()`
   resolves the recipient with the anon/RLS Supabase client, and the
   owner-email lookup (`organization_memberships → profiles.email`) is
   RLS-blocked for anon callers. In the common Stripe-deposit path the
   send originates from the webhook (no auth session), so the recipient
   resolves to `null` and the guard skips it. Cron reminders already do
   this right with the admin client — mirror that.
2. **Customer invoice is generic (BUG, high).** A professional generator
   already exists (`lib/invoices/generate-pdf.ts`) but is operator-auth
   gated; the customer's button runs a separate hand-rolled one
   (`components/portal/invoice-download.tsx`) showing ~3 of 14 fields,
   the platform's blue (not the operator brand), bare item names, no tax.
   Fix: route the portal to the good generator (token-authed) + widen
   the portal data query (branding, tax, full line items).
3. **Agreement/waiver capture nothing + can't be edited (high).**
   Clauses are hardcoded TS constants (`lib/documents/generate-pdf.ts`);
   no table/column/UI for custom terms, logo, or business address. The
   PDF injects only business name, support email, customer name, event
   date, order number, item names — no addresses, rental dates, prices,
   deposit, totals. The Documents tab has no download link. Photo-booths
   & concessions fall back to generic terms.
4. **Signup ≠ login ≠ onboarding (medium).** Login uses the branded
   `auth-card` system; signup used generic `panel`/`order-card`, no logo.
   The wizard hardcoded its vertical list (already drifted vs the
   registry; i18n still described an old 3-vertical world) and didn't
   surface what a vertical pick actually does.
5. **Verticals are capability-driven, not org-vertical-driven
   (architecture, by design).** The functional engine (pricing, PDP,
   pull-sheet, policies) keys off per-product capabilities + the
   category's vertical, so the org's vertical pick is mostly seed-time.
   Real gaps: identical dashboard nav across verticals; an
   inflatable-only hardcoded product-form accordion; missing legal terms
   for photo-booths/concessions; registry-vs-SQL category-seed drift;
   orphaned legacy car/equipment; no per-vertical deposit/risk defaults
   on the operator side (those live only in the marketplace risk-family
   registry).

---

## Phase A — New-operator journey: signup → onboarding (in progress)

- [x] Rebuild signup onto the branded `auth-card` design system (logo,
  `auth-field`, `auth-terms`, notice support) to match login
- [x] Onboarding vertical picker built from the vertical registry
  (no hardcoded list); each card previews seeded categories + the
  cancellation/lead-time policy the pick locks in
- [x] Onboarding action validates against `listVerticalSlugs()`; drop the
  dead legacy car/equipment allowlist; coerce unknown → first registry
  vertical
- [x] Remove the stale `businessType.options` i18n block (en/es/fr/pt)
  and repoint the allowlist test at the registry as source of truth
- [x] Decide: collect the vertical at SIGNUP — DECIDED (founder: move to
  signup page). Picker now leads the signup form; the choice is stored on
  auth metadata, survives email-verify, and pre-selects the onboarding
  card (still editable as a fallback)
- [x] Decide: should the wizard branch by vertical — DECIDED. Researched
  how leaders do it (Shopify/Square industry pick → tailored
  defaults/checklist; Housecall Pro/ServiceTitan "preset structure, not
  prices"; Goodshuffle = closest rental peer, sets deposit + cancellation
  in onboarding; Turo/Airbnb deposit-as-hold framing). Chosen model:
  per-vertical smart defaults (editable) + a deposit/cancellation step,
  NOT a heavy vertical-branching wizard
- [x] Per-vertical money defaults on `VerticalConfig.operatorDefaults`
  (deposit %, order minimum, delivery fee); wizard pre-fills them
  (editable) and seeds `organizations.settings.deposit_percentage` —
  closing the flat-30%-for-everyone gap
- Note: operator activation checklist already exists
  (`components/guidance/setup-checklist-card.tsx` on the dashboard) —
  making it vertical-aware is a possible future enhancement, not missing

## Phase B — Order notifications (planned)

- [ ] `getOrgBranding()` → admin client for the owner-email + org reads
  (mirror `app/api/cron/reminders/route.ts`)
- [ ] Collect/require `support_email` at onboarding
- [ ] Log/observe when `operatorAlertEmail` resolves null (no silent drop)
- [ ] Optional: a "new order" toggle in operator email preferences

## Phase C — Customer invoice (planned)

- [ ] Token-authed portal invoice route reusing `lib/invoices/generate-pdf.ts`
- [ ] Widen `PortalOrder`/`buildPortalOrder`: operator branding, tax,
  full line items (qty/unit price/line total)
- [ ] Retire the hand-rolled `invoice-download.tsx` generator

## Phase D — Agreements & waivers (planned)

- [ ] Data: inject both parties' details, rental dates, prices, deposit,
  totals into the document
- [ ] Operator template editor (custom clauses + logo + business address)
  — new `document_templates` table or columns; `getTerms()` prefers
  stored content over the constants
- [ ] Add a download/preview link on the Documents tab
- [ ] Legal terms for photo-booths & concessions (no generic fallback)

## Phase E — Vertical depth (planned, partly decision-gated)

- [ ] Reconcile category-seed drift (registry vs SQL bootstrap RPC)
- [ ] Generalize the inflatable-only product-form setup accordion
- [ ] Per-vertical dashboard nav (or decide the uniform nav is correct)
- [ ] Decide per-vertical deposit/risk defaults on the operator side
- [ ] Retire orphaned legacy car/equipment paths (SQL seeds, PDF terms, nav)

---

## Done log

- **2026-06-13 — Phase A part 3 (per-vertical onboarding defaults):**
  research-backed model (see decision above). Added
  `VerticalConfig.operatorDefaults` (deposit %, order minimum, delivery
  fee) to all 6 verticals — inflatables 30/$100/$50, tents 50/$500/$150,
  tables & chairs 30/$150/$75, dance floors 50/$300/$125, photo booths
  50/$200/$50, concessions 30/$150/$75. The wizard pre-fills delivery
  fee + order minimum from the chosen vertical (editable, re-seeds on
  vertical change) and adds a Step 3 "Deposit & cancellation" with a
  per-vertical deposit % (editable) shown alongside the cancellation
  policy and a "hold near pickup, not a charge" framing. completeOnboarding
  persists deposit_percentage into org settings (the key checkout reads via
  getBookingPolicies), closing the flat-30% gap. New i18n across 4 locales;
  registry test pins sane operator defaults. tsc/496 tests/build green.
- **2026-06-13 — Phase A part 2 (vertical pick moves to signup):** the
  vertical picker now leads the signup form (registry-driven cards via
  the shared `buildVerticalOptions()`); `signUpWithPassword` validates
  the pick against the registry and stores it on the auth user's
  metadata (`business_type`), so it survives the email-verify round trip
  (the user is signed out after signUp). Onboarding reads that metadata
  and pre-selects the matching card (still editable for anyone who
  skipped it). Option-builder extracted to `lib/verticals/options.ts` and
  shared by both surfaces. tsc/tests/build green.
- **2026-06-13 — Phase A part 1 (signup + registry-driven onboarding):**
  signup rebuilt on the `auth-card`/`auth-field`/`auth-terms` system with
  the Korent logo, two-column name/phone, and a "what's next" bridge to
  onboarding; onboarding vertical cards now generated from
  `listVerticals()` (server-built prop) with a per-vertical
  policy-summary line shown on selection; onboarding action validates
  against the registry and no longer accepts legacy car/equipment; dead
  `businessType.options` i18n removed across all four locales; the
  allowlist test repointed to pin the registry. tsc/tests/build green.
