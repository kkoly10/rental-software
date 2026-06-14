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

## Phase B — Order notifications

- [x] `getOrgBranding()` → admin client for the owner-email + org reads
  (mirror `app/api/cron/reminders/route.ts`) — fixes the silent drop on
  the Stripe-webhook + no-support_email paths
- [x] Log/observe when `operatorAlertEmail` resolves null (no silent drop)
- [ ] Collect/require `support_email` at onboarding (owner-email fallback
  now works, so this is hardening, not required)
- [ ] Optional: a "new order" toggle in operator email preferences

## Phase C — Customer invoice

- [x] Token-authed portal invoice route reusing `lib/invoices/generate-pdf.ts`
  (`app/api/portal/invoice/route.ts`)
- [x] ~~Widen `PortalOrder`~~ — not needed: the route queries the DB
  directly (admin client) for operator branding, tax, and full line
  items, so no page-payload bloat
- [x] Retire the hand-rolled `invoice-download.tsx` generator (now a link
  to the route)

## Phase D — Agreements & waivers

CORRECTION (verified against current code, not the early recon): the
document generator + route are ALREADY built out — both parties'
name/address/phone/email, rental period (start–end), itemized line items
with prices, full financials, business address + representative name (set
in Settings → business profile), brand color, and customer e-signature
all flow through. The earlier "captures nothing" finding was stale. The
founder's blank result was discoverability (no Documents-tab download)
plus testing with a bare order (no customer/items/dates → renders blank).

- [x] ~~Inject party/date/price data~~ — already present in
  `generate-pdf.ts` + the document route; business address +
  representative name already editable in Settings
- [x] Add a download link on the Documents tab (was only on the
  order-detail page — the likely reason "I tried them and got nothing")
- [x] Real terms for photo-booths & concessions (attended/per-hour;
  no more generic "no climbing on tents" fallback). Terms extracted to
  `lib/documents/terms.ts` (alias-free, unit-tested)
- [x] Operator CUSTOM-CLAUSE editor — DECIDED (founder: full clause
  editor). `document_templates` table (per org + doc type, applied to
  prod); `/dashboard/settings/documents` lets owners/admins edit every
  clause of the agreement + waiver, with reset-to-default; the PDF route
  prefers stored clauses over the built-in defaults
- [ ] ~ Logo upload on documents — deferred (needs a storage bucket +
  drawHeader change; the clause editor was the core "can't edit" ask)

## Phase E — Vertical depth (in progress)

- [x] Reconcile category-seed drift (registry vs SQL bootstrap RPC) —
  `bootstrap_organization` recreated so tents / tables-and-chairs /
  dance-floors seed the same names+slugs as the registry (and the
  add-vertical path); legacy car/equipment seed branches removed.
  Applied to prod; no live org uses car/equipment (all 5 are inflatable)
- [ ] Remove remaining orphaned legacy car/equipment (dead terms.ts keys,
  nav allowlist) — cosmetic; no live org has those business types
- [ ] Generalize the inflatable-only product-form setup accordion so
  tents (anchoring/surface) get the rich UI too
- [ ] Per-vertical dashboard nav (or decide the uniform nav is correct)

## Phase F — Storefront 10/10 (in progress)

- [x] Trust claims: removed hardcoded "insured / inspected / on-time
  guaranteed / 500+ events / permitted" defaults from all 6 verticals
  (Getaround-class overstatement — platform offers no insurance/
  inspection). Defaults are now platform-true (online booking, local,
  upfront pricing); operators add real credentials (e.g. insurance) via
  the trust-badges editor, which is now seeded from the LIVE values so
  they can see/edit/delete what's shown, with guidance that Korent
  provides no insurance/inspection
- [x] Reviews: removed the fabricated hero "5.0 · N+ reviews" rating chip
  (it was an average of operator-typed testimonials presented as
  third-party review scores). Testimonials remain as testimonials
- [ ] Service-area map vs ZIP mismatch: geocode + store lat/lng at save,
  validate city/state against ZIP, replace the US-center (Kansas)
  geocode-failure fallback with an empty state
- [ ] Real social proof option: surface the operator's Google rating
  (google_business link already collected) — competitor-standard
- [ ] Make "How it works" + browse-by-occasion tiles editable (currently
  hardcoded); integrate the "How it works" island visually
- [ ] Optional: vertical landing pages use the homepage's route-screen
  phone mockup (currently a plain crew photo)

---

## Done log

- **2026-06-14 — Storefront honesty (P0 from founder audit):** removed
  unverified, hardcoded trust claims (commercial insurance, inspection,
  on-time guarantees, "500+ events", food permits) from all 6 verticals'
  storefront defaults + ledes — they were asserted for every operator by
  default with no basis (Getaround risk; the platform provides no
  insurance/inspection). New defaults are platform-true (online booking /
  local / upfront pricing). The trust-badges editor is now seeded from the
  LIVE effective badges (was empty) so operators can see/edit/remove what's
  shown, with explicit guidance to only claim credentials they hold and
  that Korent provides no insurance/inspection. Removed the hero "5.0 · N+
  reviews" chip — it was the average of operator-typed testimonials shown
  as a third-party review score (no storefront review system exists;
  verified reviews live only on the marketplace). tsc/503/build green.
  Remaining storefront items tracked in Phase F (map mismatch, Google
  reviews, editable how-it-works/browse tiles).
- **2026-06-13 — Document/invoice logo (path-to-10 item 4):** operators
  already upload a logo (settings.brand_logo_url, with storage + UI), it
  just wasn't used on the PDFs. drawHeader now renders the logo (scaled to
  aspect, max 38pt tall) in place of the name wordmark when present, and
  falls back to the business name on any failure (logo is purely
  additive — no logo = clean name letterhead, unchanged). New
  best-effort fetchLogoDataUrl helper (validates image type, 3MB cap)
  wired into all three PDF routes — operator invoice, customer portal
  invoice, and documents. tsc/503/build green. All four path-to-10 items
  now complete.
- **2026-06-13 — New-operator journey polish (path-to-10 items 1–3):**
  signup now REQUIRES the vertical pick (native required on the radios) —
  the account can no longer be created without it. Onboarding rebuilt onto
  the branded auth-card chrome (gradient bg, Korent logo, auth-title) so
  the whole pre-dashboard journey — login, signup, verify-email, error,
  onboarding — is now one consistent design instead of dropping to the
  generic panel look after signup. Onboarding is now a real 3-step wizard
  (vertical+business → service area → deposit) with a "Step n of 3"
  segmented progress bar and Back/Continue gating, instead of one long
  scroll; all fields stay mounted so the single submit + slug-check +
  draft persistence + per-vertical money defaults are unchanged. New i18n
  across 4 locales. Remaining path-to-10 item: document/invoice logo
  upload. tsc/503/build green.
- **2026-06-13 — Auth confirmation hardening (signup bug from founder
  testing):** founder signed up in Chrome on mobile, opened the email in
  Gmail's in-app browser, and hit a raw "PKCE code verifier not found"
  error — the confirmation link is a PKCE `?code=` link whose verifier
  lives only in the originating browser, so any mail-app in-app browser
  fails (near-universal on mobile). Code side: rebuilt `/auth/error` and
  `/auth/verify-email` on the branded auth-card system, mapped link
  failures to friendly copy (no raw PKCE jargon), added a self-serve
  ResendVerificationForm to both, and fixed the verify-email page reusing
  password-reset copy ("we sent a reset link"). ROOT-CAUSE FIX is a
  founder dashboard change: switch the Supabase email templates to the
  stateless token_hash format pointing at /auth/confirm (the route
  already supports verifyOtp/token_hash) — see chat for exact snippets.
  tsc/503/build green.
- **2026-06-13 — Phase D slice 2 (full document clause editor):** new
  `document_templates` table (per org + doc type, RLS owner/admin-write,
  applied to prod). `/dashboard/settings/documents` (linked from Settings)
  lets owners/admins edit, add, and remove every clause of the rental
  agreement and safety waiver, seeded from the org's per-vertical defaults,
  with a per-document reset-to-default and a "keep your liability clauses"
  warning. `saveDocumentTemplate`/`resetDocumentTemplate` actions
  (owner/admin-gated). The document PDF route loads the org's template and
  passes the clauses; the generator resolves operator clauses over the
  built-in defaults via the new pure `resolveDocumentClauses` (4 unit
  tests). 503/503, tsc/build green.
- **2026-06-13 — Phase D slice 1 (document discoverability + vertical terms):**
  verified the doc generator already captures both parties + dates +
  prices + financials (the early "captures nothing" recon was stale).
  Added a Download link for the agreement and waiver on the Documents tab
  (previously only reachable from the order-detail page — the likely
  cause of the founder's blank result). Wrote dedicated rental-agreement
  + safety-waiver terms for photo-booths and concessions (attended,
  per-hour, power/space/food-handling) so they no longer inherit the
  generic "no climbing on tents" block. Terms extracted to alias-free
  `lib/documents/terms.ts` with `getTerms` exported + 4 unit tests
  (500/500). The custom-clause editor + logo (the "can't edit" gap)
  remains decision-gated. tsc/build green.
- **2026-06-13 — Phase C (professional customer invoice):** the customer
  "Download invoice" button previously ran a separate hand-rolled
  client-side jsPDF (≈3 of 14 fields, platform blue, bare item names, no
  tax). New token-authed route `app/api/portal/invoice` reuses the same
  `generateInvoicePdf` as the operator side — branded to the operator,
  From/Bill-To, itemized table (qty/unit/line total), tax line, amount
  paid + balance due. Authorized by the order's portal access token
  (both magic-link and order#/email lookups already produce one); anon
  reads via the admin client with strict orgId filtering; financials via
  `getOrderFinancialsAdmin` so deposits-paid are reflected.
  `invoice-download.tsx` is now just a link to the route. tsc/496/build green.
- **2026-06-13 — Phase B (operator new-order email fix):** root cause was
  `getOrgBranding()` (lib/email/triggers.ts) resolving the recipient with
  the request-scoped anon/RLS client — which returns zero rows for
  `organizations` + `organization_memberships` in the Stripe-webhook /
  no-session context, so both `support_email` and the owner-email
  fallback came back null and the `if (operatorAlertEmail)` guard silently
  skipped the send. Switched both reads to the admin client (mirroring the
  cron reminder path), and added a `logAppError` when no recipient
  resolves so it can't regress silently. Customer confirmations were
  unaffected (they don't depend on that lookup). tsc/496 tests/build green.
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
