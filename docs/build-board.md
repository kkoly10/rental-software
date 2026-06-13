# Build Board — master checklist

**Created:** 2026-06-13 · **Owner:** founder + Claude · **Status:** live

One place to see what's done, what's in flight, and what's next across
every workstream. The detail docs below are the source of truth for
granular sub-tasks; this board is the index + live status + shipped log.
Check items off here as each ships, and move the line into **Shipped**
with its PR number.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `~` deferred

### Detail trackers
- **Operator fixes:** `docs/operator-fix-plan.md` (build sequence) ← driven by `docs/operator-gap-audit.md` (findings)
- **Marketplace experience/account:** `docs/marketplace/experience-account-roadmap.md`
- **Marketplace spine (owned elsewhere):** `master-plan.md`, `improvement-roadmap.md`, `build-tracker.md`, `trust-monetization-sprint.md`

---

## ▶ Current focus

Operator **Wave 1 (P0 correctness)** — 2 of 4 shipped (#413: operator email + no-op guard). Remaining: quantity-aware availability + maintenance hold, blocked on the **capacity-model decision** (recommend A: add `quantity_on_hand`).

---

## Operator SaaS — fix plan  (`operator-fix-plan.md`)

**Wave 0 — config (founder, no code)**
- [ ] Set/verify production env in Vercel: `RESEND_API_KEY` (verified domain), `CRON_SECRET`, Stripe keys
- [ ] Twilio: now a Pro feature (shipped) — only needed when re-enabling SMS for paid orgs

**Wave 1 — stop the bleeding (P0)**
- [ ] Quantity-aware availability (block overselling) — *blocked on capacity-model decision (A: add `quantity_on_hand`)*
- [x] Production no-op guard (no silent "success" without charge/persist) — #413
- [x] Operator new-order email (decouple from customer-email gate) — #413 *(Resend domain verify is founder config, Wave 0)*
- [ ] Maintenance "out of service" hold blocks availability — *fold into the availability PR (exclude maint-held assets in the reserve RPC)*

**Wave 2 — originating complaints**
- [ ] Rental docs overhaul (full party details, rental period, itemized, two-party signature)
- [ ] Operator-editable agreement/waiver templates + logo
- [ ] Customer invoice → route through editorial generator
- [ ] Self-service balance payment + balance-due reminder cron

**Wave 3 — inventory & financial truth**
- [ ] Inventory count master data ("we own N")
- [ ] Operator payout/earnings dashboard
- [ ] AR / aging rollup
- [ ] Analytics scale fix (date range, remove 5k cap)

**Wave 4 — logistics**
- [ ] Crew & vehicle capacity / conflict checks + fleet master data
- [ ] Delivery time-window enforcement

**Wave 5 — risk & compliance**
- [ ] Safety inspections (wire the dead table; gate re-rent for inflatables)
- [ ] Certificate of Insurance (COI) upload/track
- [ ] Damage baseline photos + structured claims
- [ ] Document resend / delivery proof / expiry

**Wave 6 — CRM & growth**
- [ ] CRM tags/segments, LTV, repeat-customer view, notes timeline
- [ ] Lifecycle comms (post-event review, abandoned-quote, win-back) + operator-initiated SMS
- [ ] Operator email lifecycle gaps

**Wave 7 — advanced/scale** ~ (deferred): consumables · multi-location · kit availability · serialized enforcement · advanced pricing · route re-optimization · 2-way QBO/Xero · calendar reschedule

---

## Marketplace — experience & account  (`experience-account-roadmap.md`)

- [ ] **Phase A** — visual/IA polish (Inter Tight, one search bar, white CTAs, de-emoji, footer + Seller Hub rebuild)
- [ ] **Phase B** — account & settings shell (profile, login/security, notifications, privacy, preferences)
- [ ] **Phase C** — renter money (saved cards, addresses, deposits/receipts)
- [ ] **Phase D** — seller money (payout status, balance, tax/1099-K, fees)
- [ ] **Phase E** — discovery (search facets, PDP completeness, favorites, SEO)
- [ ] **Phase F** — trust & safety (report/flag, moderation UI, reviews)
- [ ] **Phase G** — compliance (marketplace facilitator sales tax, 1099-K, a11y)
- [ ] **Phase H** — lifecycle & growth

---

## ✅ Shipped this session

| PR | What |
|---|---|
| #385 | Marketing/vertical editorial redesign + 18 vertical photos |
| #387 | Real product screenshots in marketing |
| #390 | Personality pass — full-bleed heroes, arched tiles, full-width storefront booking bar |
| #391 | Pricing page → editorial system |
| #393 | Editorial PDF documents (invoice/agreement/waiver) + drop Free tier |
| #394 | Editorial transactional emails |
| #397 | Dashboard fixes — guidance persistence, payments layout, sidebar, search, nav speed |
| #400 | Site-wide nav perf (middleware auth tax) + compact sidebar footer |
| #403 | Crew Mobile field-tool rebuild |
| #404 | Per-vertical live storefront screenshots |
| #406 | Marketplace experience/account roadmap (doc) |
| #409 | Operator operational gap audit (doc) |
| #410 | Operator fix plan + Vercel env reference (doc) |
| #411 | SMS gated behind Pro plan |
| #412 | Master build board (this doc) |
| #413 | P0 — operator new-order email always fires + no fake success on misconfigured deploys |
