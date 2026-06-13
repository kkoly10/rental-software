# Operator SaaS — Fix Plan (execution sequence)

**Created:** 2026-06-13 · **Owner:** founder + Claude · **Status:** ready to build

The build sequence for `operator-gap-audit.md`. The audit says *what's
wrong*; this says *how and in what order we fix it*, grouped into
shippable waves with acceptance criteria. Same convention as the
marketplace `build-tracker.md`.

**Principle:** stop the bleeding (silent money/trust losses) before
building new surface. Waves are ordered by risk-reduction per unit of
work. Each wave is 1–2 PRs.

Legend: `[ ]` todo · `[x]` done · `~` deferred

---

## Wave 0 — Config prerequisite (no code; do this first)

- [ ] Set the missing **production env vars in Vercel** (see the env table at the bottom). The biggest live impact: confirm **RESEND** (emails) and **TWILIO** (SMS) are fully set in the **Production** environment and **redeploy** after adding.
- [ ] Twilio specifically: set **all three** `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_PHONE_NUMBER` (a real SMS-capable number in `+1…` form, *not* a Messaging Service SID — the code doesn't support that yet), turn **SMS on in dashboard Settings**, ensure the customer has **`sms_opt_in`**, and complete **A2P 10DLC registration** in Twilio (US SMS from a 10-digit number is filtered until registered).

## Wave 1 — Stop the bleeding (P0 correctness)

**Goal:** no silent overselling, no silent no-charge, operators always notified.

- [ ] **Quantity-aware availability.** Gate the reserve RPC on `quantity × overlapping` vs. asset capacity; surface a quantity field on order items. *Accept: booking 4 assets of a 3-asset product is rejected; per-unit products check real stock.*
- [ ] **Production no-op guard.** Refuse silent success in checkout + record-payment when Supabase/Stripe env is missing on a live host (throw/alert, don't return ok). *Accept: a misconfigured prod order errors loudly instead of "Payment recorded".*
- [ ] **Operator new-order email.** Decouple the operator alert from `if (!customerEmail) return`; send the alert regardless of whether the customer has an email; verify Resend FROM domain is authorized. *Accept: every new order (dashboard or web) emails the operator.*
- [ ] **Maintenance hold UX.** "Mark out of service" blocks availability immediately. *Accept: a unit flagged damaged Friday is unbookable Saturday.*

## Wave 2 — The originating complaints (docs, invoice, balance payment)

**Goal:** professional, complete paperwork and self-service balance collection.

- [ ] **Rental docs overhaul** — merge both parties' full details (renter name/address/phone; business name/address/phone), rental period, itemized equipment + quantities, deposit/total, and a **two-party signature block**. *(Editorial styling already done #393.)*
- [ ] **Operator-editable templates** — Settings UI to customize agreement + waiver text and logo; current vertical boilerplate becomes the default; store a **terms version/hash + agreed-at + received-at** with each signature.
- [ ] **Customer invoice** — route the order-status "Download invoice" through `lib/invoices/generate-pdf.ts` (kill the bare jsPDF that omits the business name).
- [ ] **Self-service balance payment** — Stripe checkout link for the remaining balance + a "pay your balance" email, and a **balance-due reminder cron**. *Accept: customer pays the balance online without operator involvement.*

## Wave 3 — Inventory & financial truth

- [ ] **Inventory count master data** — "we own N of this" on the product form, reconciled with the asset model.
- [ ] **Operator payout/earnings dashboard** — Stripe balance (pending/available), payout schedule + history, fees.
- [ ] **AR / aging rollup** — outstanding balances bucketed; not just a payment list.
- [ ] **Analytics scale fix** — date-range picker, remove/raise the silent 5,000-order cap.

## Wave 4 — Logistics integrity

- [ ] **Crew & vehicle capacity / conflict checks** — fleet master data (vehicles table + capacity), driver shift/availability, block overlapping assignments.
- [ ] **Time-window enforcement** — factor setup/teardown + drive time; flag overlapping windows.

## Wave 5 — Risk & compliance

- [ ] **Safety inspections** — wire the dead `inspections` table: log inspections, and gate re-rent on a passed inspection for inflatable verticals.
- [ ] **Certificate of Insurance** — upload/track/verify; flag venue COI requirement on an order.
- [ ] **Damage baseline** — required before/after condition photos; structured damage claim → charge against deposit.
- [ ] **Document resend + delivery proof + expiry** — regenerate/resend, log send time, honor `expires_at`.

## Wave 6 — CRM & growth

- [ ] CRM tags/segments, LTV, repeat-customer view, notes timeline.
- [ ] Lifecycle comms: post-event review request, abandoned-quote recovery, customer win-back; operator-initiated SMS + template library.

## Wave 7 — Advanced / scale (deferred until the above lands)

- [ ] Consumables stock · multi-location inventory + transfers · kit/bundle availability · serialized-asset enforcement · advanced pricing (seasonal/weekend/tiered/coupons) · in-flight route re-optimization + live tracking · two-way QBO/Xero + GL mapping · calendar drag-to-reschedule.

---

## Environment variables (Vercel) — complete reference

Set in **Production** (and Preview if you test there); **redeploy** after changes.

### Required for core operation
| Var | Purpose | Symptom if missing |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | DB, auth, orders | App falls to demo mode (the "Application Not Configured" guard) |
| `SUPABASE_SERVICE_ROLE_KEY` | server tasks, rate limiting, crons | Secure server actions fail |
| `NEXT_PUBLIC_SITE_URL` + `SITE_URL` | auth redirects, cron/background URLs | Broken redirects; crons can't build links |
| `NEXT_PUBLIC_APP_DOMAIN` | subdomain/tenant routing | Storefront subdomains misresolve |
| `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | payments + subscription billing | Checkout/payment fails; webhooks unverified |
| `RESEND_API_KEY` (+ optional `EMAIL_FROM_ADDRESS`) | **all transactional email** | **No emails send at all** (order alerts, receipts, docs). FROM domain must be **verified in Resend**. |
| `CRON_SECRET` | authorizes Vercel cron routes | Reminders/holds/reconcile crons reject — **deposit reminders, return reminders, hold cleanup all stop** |

### SMS / WhatsApp (your current issue)
| Var | Purpose | Note |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio auth | needed |
| `TWILIO_AUTH_TOKEN` | Twilio auth | needed |
| `TWILIO_PHONE_NUMBER` | the FROM number | **must be a real SMS-capable number in `+1…` form — a Messaging Service SID will NOT work** (code uses `From=` only). **All three required or SMS silently runs in demo mode** (logs, returns fake success). |
| `WHATSAPP_TEMPLATE_*` | WhatsApp content SIDs | only after Meta template approval |

Beyond env, SMS also requires: **dashboard SMS toggle ON**, customer **`sms_opt_in` = true**, and **A2P 10DLC** brand/campaign registration in Twilio for US numbers.

### Optional integrations
| Var(s) | Unlocks |
|---|---|
| `OPENAI_API_KEY` *or* `ANTHROPIC_API_KEY` | AI Copilot (else built-in KB) |
| `MAPBOX_ACCESS_TOKEN` | route auto-optimization |
| `QBO_CLIENT_ID/SECRET/REDIRECT_URI/ENVIRONMENT` | QuickBooks sync |
| `XERO_CLIENT_ID/SECRET/REDIRECT_URI` | Xero sync |
| `NEXT_PUBLIC_SENTRY_DSN` | error monitoring |
| `STRIPE_*_PRICE_ID` (6) | subscription plan prices |
| `NEXT_PUBLIC_MARKETPLACE_HOST` / `STRIPE_MARKET_WEBHOOK_SECRET` / `PLATFORM_ADMIN_EMAILS` | marketplace |
| `EMAIL_VIEW_SECRET` / `PORTAL_TOKEN_MAX_AGE_DAYS` / `PII_PURGE_RETENTION_DAYS` | portal-mail signing / token lifetime / PII retention |

---

## Done log

*(move items here with PR numbers as they ship)*
