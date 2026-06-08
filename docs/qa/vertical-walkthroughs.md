# Vertical end-to-end walkthroughs

Tracks the operator + customer journey for each of the 6 day-one
verticals so we can catch and fix the gaps before any of them go to
a real paying operator.

## Driving setup

- **Environment**: live production (`https://korent.app` and subdomains).
- **Test orgs**: each vertical gets its own org named
  `[E2E TEST] <Vertical>` so cleanup is easy and prod operators don't
  see them.
- **Test email**: `e2e+<vertical>@<dead-domain>` so the real
  verification + welcome + receipt emails land somewhere disposable.
- **Stripe**: walks stop **before** the deposit charge unless the
  operator has Stripe test-mode keys configured for the prod org —
  the goal is end-to-end coverage of code paths, not real money.
- **Playwright**: `tests/e2e/<vertical>.spec.ts` drives the browser.
  Each spec is independent + can run solo.

## Matrix — 6 verticals × 9 journey stages

Legend: ✅ pass · ⚠️ pass with issue (see notes) · ❌ blocked · ⏳ not driven yet

| Stage | Inflatable | Tents | Tables & Chairs | Dance floors | Photo booths | Concessions |
|---|---|---|---|---|---|---|
| 1. Marketing → Signup | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 2. Login → dashboard | ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 3. Store setup / products | ⚠️ → ✅ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 4. Customer browse (storefront PDP) | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 5. Customer checkout + deposit | ❌ Stripe not configured | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 6. Operator receives order | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 7. Delivery + crew + pull sheet | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 8. Balance + documents + close | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 9. Repeat customer / CRM | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

## Cross-cutting concerns (one walk covers all verticals)

| Concern | Status | Notes |
|---|---|---|
| Notifications — customer email | ⏳ | order conf, deposit receipt, reminder, pickup |
| Notifications — operator email | ⏳ | new order alert, balance overdue |
| Notifications — SMS opt-in | ⏳ | Twilio configured? |
| Notifications — WhatsApp opt-in | ⏳ | wired in #267 |
| Stripe deposit flow | ⏳ | test mode preferred |
| Stripe webhook idempotency | ⏳ | replay attack test |
| Document signing (rental agreement) | ⏳ | how does customer reach the signer URL? |
| Document signing (safety waiver) | ⏳ | inflatable-only? or universal? |
| Customer tracking page `/track/[token]` | ⏳ | where does the link come from? |
| Multi-vertical org add (Phase 4) | ⏳ | Settings → Verticals card → add |
| Team management (Settings → Team) | ⏳ | invite + crew/admin/owner enforcement |
| Mobile responsiveness | ⏳ | operator + customer + crew |
| i18n (es / fr / pt) | ⏳ | spot-check one non-English locale |
| Edge cases — out of service area | ⏳ | |
| Edge cases — below minimum order | ⏳ | |
| Edge cases — product on maintenance | ⏳ | |
| Edge cases — Stripe down / demo mode | ⏳ | |
| Edge cases — lead-time conflict | ⏳ | |
| SEO — `/inflatable-rental-software/` etc | ⏳ | renders, OG tags |

## Findings log

Anything not "✅ pass" gets a short entry here with the bug + a
proposed fix.

### Stage 1 — Marketing → Signup

**Inflatable** (`https://korent.app/inflatable-rental-software`) — ✅ pass.
- Marketing page loads, title matches `/Inflatable/i`.
- Signup CTA visible + clicks through to `/signup`.
- Signup form renders all required fields (`email`, `password`,
  `full_name`, `terms_accepted`).
- (Did not actually submit — operator account already exists.)

### Stage 2 — Login → dashboard

**Inflatable** (`komlankouhiko@icloud.com` / `Couranr LLC`) — ✅ pass.
- `/login` → submit → lands on `/dashboard`.
- Sidebar shows all 4 groups (Ops, Catalog, Finance, Admin) with
  the post-#304 fix in place. Deliveries item visible (would have
  been hidden pre-fix for non-inflatable verticals).
- Header shows the org name "Couranr LLC".

### Stage 3 — Store setup

**Inflatable** — ⚠️ pass with 3 observations to verify.

The walkthrough confirms `/dashboard/products` renders 3 existing
products on this mature account, and `/dashboard/products/new`
renders the form. **Three things to verify next:**

1. **Category mis-assignment.** Product *"20x20 Party Tent"* is
   filed under category **"Bounce Houses"**. Operator-side mistake
   or a real bug in category resolution? Likely the former since
   the org's `business_type = 'inflatable'` and the operator
   created the product. But it's the kind of thing a multi-vertical
   add (#298) would have to handle correctly — if this org later
   adds the tents vertical via the settings card, "20x20 Party
   Tent" should be reassignable, not silently re-filed.

2. **Product named "Scheduled delivery"** — looks like leftover
   test data, not a real product name. Not a bug, just cleanup.

3. **`<ContextHelpBanner>` showing "Add new product"** on
   `/dashboard/products` despite the account having 3 products.
   Verify the banner is gated on `productsCount === 0`, not just
   "user hasn't dismissed it." If the dismiss is the only gate,
   that's a UX bug — mature accounts shouldn't see new-operator
   onboarding nudges.

**Real bug found — Stage 3c product creation silently fails with
"Required":** the Playwright spec drove a fresh operator through
`/dashboard/products/new` with the starter-example fields filled
in (name, base price, category, description, is_active) and the
form refused to save — `state.message = "Required"`, page rerendered
empty.

Root cause: `lib/validation/products.ts:91` — `unitLabel` field is
declared as `optionalText("Unit label", 32)` with no `.optional()`
on the outside. `optionalText` is misleadingly named — it accepts
an empty string but **starts with `z.string()` so it rejects
undefined** with the bare "Required" Zod default message. The
action's `readPerUnitFields` returns `unitLabel: undefined` when
the input is blank, which is the steady-state for any product
that doesn't carry the `pricing.per-unit` capability — i.e. every
inflatable, tent, dance-floor-by-section-not-by-unit product the
operator tries to save.

This is a **launch-blocker for inflatable, the day-one vertical** —
no operator could create their first product on a fresh org.

Fix: add `.optional()` to the schema so undefined passes through,
matching how `wetUpcharge`, `hourlyRate`, etc. handle the same
blank-input case. Pinning the parse with a unit test would be
worth doing in a follow-up so the misleadingly-named helper
doesn't strike again.

### Stage 4 — Customer browse

(not yet driven; spec needs the operator's public storefront URL —
look it up from `organizations.slug` and run a separate anonymous
walk against `<slug>.korent.app`.)

### Stage 5 — Customer checkout + deposit

Blocked across all verticals — Stripe is not yet configured for
the prod org. Re-run this stage once Stripe test-mode keys are
wired so we can verify deposit charges + webhook delivery without
real money.

### Stage 4 — Customer browse

(no findings yet)

### Stage 5 — Checkout + deposit

(no findings yet)

### Stage 6 — Order management

(no findings yet)

### Stage 7 — Delivery + crew

(no findings yet)

### Stage 8 — Balance + documents + close

(no findings yet)

### Stage 9 — Repeat customer

(no findings yet)

### Cross-cutting

(no findings yet)
