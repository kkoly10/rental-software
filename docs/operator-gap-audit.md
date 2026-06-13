# Operator SaaS — Operational Gap Audit

**Created:** 2026-06-13 · **Owner:** founder + Claude · **Status:** open

A systematic audit of the **operator (SaaS) side** against what a real
party/event/inflatable rental business needs, triggered by discovering
the rental-agreement/waiver generator was demo-grade. Six parallel
recons traced the live code (inventory, payments, contracts, delivery,
CRM/comms) and benchmarked seven competitors (Goodshuffle Pro, Booqable,
Rentle, Inflatable Office, Event Rental Systems, TapGoods, Twice).

**The thesis that proved true:** several features *look* finished but
stop short of their core job — a "demo-grade" pattern. The waiver
generator was one instance; this audit found more, including a few that
silently lose money or oversell inventory.

Legend: `[ ]` todo · `[x]` done · `~` deferred ·
**TS** = competitor table-stakes (deal-breaker if missing)

Depth ratings from the audit: REAL (works) · PARTIAL (works, key
capability missing) · DEMO-GRADE (scaffold/looks-built-but-isn't) ·
MISSING.

---

## P0 — Correctness / money / legal (fix first; these silently break trust)

- [ ] **Multi-unit bookings silently ignore quantity → overselling.** `order_items.quantity` is effectively cosmetic; availability reserves **1 unit regardless of quantity**. An operator with 3 chair assets can accept 4 orders of "10 chairs" (40 chairs booked against 3). **TS** (real-time double-booking prevention is the #1 table-stakes capability). *Verify, then gate availability on quantity × overlap.* — `lib/checkout/actions.ts:1360`, `lib/orders/actions.ts:646`, `20260514_020000_atomic_availability_reserve.sql`
- [ ] **Demo-mode no-op can reach production.** If Supabase/env is misconfigured, checkout (`actions.ts:302`) and manual payment (`payments/actions.ts:50`) **return success without charging or persisting** — customer thinks they paid, nothing happens. Add a hard production guard that refuses silent success.
- [ ] **Operator gets no new-order email** in the dashboard path: `triggerDashboardOrderEmail` bails `if (!customerEmail) return`, skipping the *operator* alert too; also verify Resend sending-domain is authorized (silent-fail suspect). — `lib/email/triggers.ts`
- [ ] **Safety-inspection feature is dead code.** An `inspections` table exists in the schema but is **never read or written anywhere**. Inflatables legally require periodic safety inspections in many US states → real compliance exposure presented as a built feature. **TS (inflatable niche)** — `supabase/schema.sql:244`
- [ ] **No "out for maintenance" mid-rental hold** — a tent damaged Friday can still be booked Saturday unless the maintenance record is manually closed in the right order.

## P1 — Table-stakes gaps that block running a real business

- [ ] **Documents capture almost nothing + operator can't edit terms.** Rental agreement/waiver merge only customer + business *names*; no addresses, phone, rental period, $ amounts, itemized equipment, or two-party signature block; terms are hardcoded per vertical with **zero editing UI**. **TS** *(the originating complaint — full overhaul: rich merge fields + operator-editable templates + logo)* — `lib/documents/generate-pdf.ts`
- [ ] **No self-service balance payment.** After the deposit, the customer **cannot pay the remaining balance online** — no payment link, no email; the operator chases it manually. **TS** — `lib/checkout/actions.ts:1199`
- [ ] **Customer invoice is generic & unbranded.** The order-status "Download invoice" is a separate bare jsPDF that doesn't even print the business name; never got the editorial redesign that the operator invoice did. **TS** *(route it through `lib/invoices/generate-pdf.ts`)* — `components/portal/invoice-download.tsx`
- [ ] **No inventory count master data.** A product has no "we own N of these" field; availability is an invisible count of manually-created asset rows. Forget to create an asset → product reads as unavailable. **TS** — products schema
- [ ] **No automated balance-due / payment reminders.** Orders sit with a balance indefinitely; no dunning. **TS**
- [ ] **No crew/vehicle capacity or availability checks.** One driver can be assigned to overlapping routes; no fleet master data, no per-vehicle capacity, no shift limits. (Route building + Mapbox optimization themselves are REAL.) **TS**
- [ ] **No operator payout / earnings dashboard.** Operators can't see Stripe payouts, fees, or settlement timing in-app. **TS**

## P2 — Important (risk, professionalism, retention)

- [ ] **E-sign consent is ephemeral** — the "I agree" checkbox isn't stored; no terms-version/hash, no document-received timestamp; weak if ever challenged. — `lib/portal/sign-document.ts`
- [ ] **No operator counter-signature / witness** on waivers (many states/venues expect dual signature).
- [ ] **No Certificate of Insurance (COI) handling** — no upload/track/verify; corporate/wedding/school venues require it. *(Opportunity — not universally table-stakes.)*
- [ ] **Damage claims lack a pre-delivery baseline** — charges are free-form, no required before/after condition photos; dispute-prone.
- [ ] **Document resend / delivery-proof / expiry unenforced** (`expires_at` never set; no regenerate/resend).
- [ ] **AR / aging is list-only** — no outstanding-balance rollup or aging buckets.
- [ ] **Analytics silently truncates at 5,000 orders** — no date range, no drill-down; trust breaks at scale. — `lib/data/analytics.ts`
- [ ] **CRM is thin** — no tags/segments, no LTV, no repeat-customer view, no notes timeline / activity log.
- [ ] **Missing lifecycle comms** — post-event review request, abandoned-quote recovery, balance-due reminder. No automated customer win-back.
- [ ] **Operator can't initiate SMS** from the dashboard (inbound + reply only); no template library.

## P3 — Scale & advanced (after the above)

- [ ] **Consumables tracking** (napkins, syrup, ice, fuel) — add-ons are pricing-only, no stock depletion. (Matters for concessions.)
- [ ] **Multi-location inventory** — assets have a single free-text `location_label`, no warehouse scoping/transfers.
- [ ] **Kits/bundles availability** — add-ons exist but availability is product-level only (sub-items not checked).
- [ ] **Serialized-asset enforcement** — `requires_serialized_asset` flag exists but is never enforced at booking.
- [ ] **Advanced pricing** — seasonal/weekend uplift, tiered duration discounts, coupons (competitor standard).
- [ ] **In-flight route re-optimization** + live driver tracking surfaced to the dispatcher (location is logged, not shown).
- [ ] **Two-way QuickBooks/Xero sync + GL mapping** (currently one-way, catch-up only).
- [ ] **Calendar drag-to-reschedule + utilization/conflict overlay** (currently read-only).

---

## What's genuinely solid (don't relitigate)

Stripe Connect settlement, deposits, partial refunds, per-jurisdiction
tax, atomic single-unit double-booking prevention (advisory lock),
setup/breakdown buffer windows, maintenance-record availability holds,
manual route building + Mapbox optimization + proof-of-delivery capture,
SMS/WhatsApp infrastructure, the core lifecycle email set, and the
(recently redesigned) operator invoice + editorial PDF chrome.

## Competitor table-stakes scorecard (the 10 non-negotiables)

| # | Non-negotiable | Korent status |
|---|---|---|
| 1 | Real-time availability + hard double-booking (incl. buffers) | PARTIAL — breaks on quantity >1 |
| 2 | 24/7 online booking + quote→order | REAL |
| 3 | Duration-based pricing + add-ons/discounts/tax | PARTIAL (tax/add-ons yes; tiered/seasonal/coupons no) |
| 4 | Online payments + deposit-then-balance + refund tracking | PARTIAL — no self-service balance payment |
| 5 | Damage protection (deposit hold OR waiver fee) | PARTIAL (waiver surcharge + card-on-file charge exist; no pre-auth hold operator-side) |
| 6 | E-sign contracts + waiver capture, editable templates | PARTIAL — capture works; templates not editable; consent not stored |
| 7 | Delivery routing + crew/truck scheduling + load sheets | PARTIAL — routing real; capacity/availability missing |
| 8 | Automated confirmations + payment reminders | PARTIAL — confirmations yes; balance reminders no |
| 9 | Reporting + QuickBooks sync | PARTIAL — one-way sync; analytics caps at 5k |
| 10 | Role-based permissions + customer self-service portal | REAL (roles + portal exist) |
| + | (Inflatable) safety-inspection-before-re-rent | MISSING — dead table |

---

## Done log

*(move items here with PR numbers as they ship)*
