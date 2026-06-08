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
| 1. Marketing → Signup | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 2. Email verify → Onboarding | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 3. Store setup (profile, policies, first product) | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 4. Customer browse (storefront PDP) | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 5. Customer checkout + deposit | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
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

(no findings yet)

### Stage 2 — Onboarding

(no findings yet)

### Stage 3 — Store setup

(no findings yet)

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
