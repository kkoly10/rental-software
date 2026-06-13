# Marketplace Experience & Account Roadmap

**Created:** 2026-06-13 · **Owner:** founder + Claude · **Status:** in progress

This tracker owns the **experience layer** of the marketplace — the
visual/IA polish, the (currently nonexistent) account & settings system,
and the discovery / trust-surface / compliance gaps found in the
2026-06-13 review. Check items off as they ship.

**Why this document exists.** The marketplace *spine* is mature and
largely tracked elsewhere — bookings, deposit holds, the evidence
ceremony, disputes, reviews, extensions, cancellations, messaging, KYC,
risk families, reminders. What was missing is the **surface a real user
touches**: the marketplace still wears the old Sora/Jakarta "template"
look, the Seller Hub layout is an afterthought, and there is **no
account/settings system at all** (verified 2026-06-13: no
`/market/account`, no saved payment methods, no addresses, no
notification preferences, no login/security page). This doc sequences
that work so a renter and a seller each get a complete, trustworthy
account experience.

**Scope boundary — what lives in OTHER trackers (do not duplicate here):**
- `master-plan.md` — full system design (pricing, deposit/hold engine,
  payments/tax architecture §16, search/ranking §22, moderation §20–21,
  prohibited items §26, comms matrix §25).
- `improvement-roadmap.md` — KYC→bookability gate, pricing calculator,
  pickup/return reminders, extensions, multi-item, standby queue.
- `build-tracker.md` + `trust-monetization-sprint.md` — evidence
  ceremony, demand capture, listing-quality score, trust badges,
  delivery/setup, risk contracts, packages, Condition Proof.

When an item here depends on or overlaps one of those, it's marked
`↪ see <doc>`.

**Build order:** A → B → C → D first (the experience + account core),
then E / F / G / H prioritized by risk. A ships standalone (no backend).

Legend: `[ ]` todo · `[x]` done · `~` deliberately deferred

---

## Locked decisions (2026-06-13)

| Decision | Choice | Rationale |
|---|---|---|
| **Typography** | Single neutral sans — **Inter Tight** for display + body; drop Sora + Plus Jakarta and any serif | Editorial Fraunces is "fancy" / wrong for commerce; Sora reads as template. Inter Tight is neutral, modern (cf. Airbnb Cereal / Amazon Ember), already loaded product-wide → cohesion, no new font weight. Tighten heading tracking for a commerce feel. |
| **Search bars** | **One persistent top-nav search** on every page; remove the duplicate hero search box | eBay/Amazon model; two near-identical search bars is a documented anti-pattern. Hero becomes a merchandised banner (metro selector + trust row + one CTA). Airbnb-style collapsing search widget deferred. |
| **CTA hierarchy** | All `.mk-btn` → white text on orange, no heavy ink border; one filled primary per view, rest ghost/outline | The base button was dark-text + 2px border on orange; only `.mk-join` was the clean white-on-orange. Unify on the one that looks right. |
| **No emoji as UI** | Replace 🛡️📸✅📍 etc. with clean inline SVG | Emoji-as-icon is the strongest "AI/afterthought" tell. |
| **Account model** | One account, existing renter↔seller mode toggle. **Payments (renter, money-out) and Payouts (seller, money-in) are separate surfaces.** Login + identity consolidated into one "Login & security". Tax coupled to payouts. | Consistent across Airbnb / Amazon / eBay / Etsy. |

---

## Phase A — Visual & IA polish *(PR 1 — no new backend)*

**Why:** the marketplace is the last surface on the old template look;
this is the highest-visibility, lowest-risk win and unblocks a
professional first impression.

- [ ] Typography swap: Inter Tight for `--mk-font-display` + `--mk-font-body`; remove Sora/Jakarta `localFont` registrations + vendored woff2; tighten heading letter-spacing
- [ ] Search dedup: delete the hero `.mk-search.hero`; keep the persistent top-nav search; rebuild hero as photo banner + metro selector + trust row + single "Browse rentals" CTA
- [ ] CTA unification: `.mk-btn` base → white-on-orange, drop the 2px ink border; audit every CTA for one-primary-per-view
- [ ] De-emoji: hero trust badges, nav metro pin, footer pin, world `.mk-ico` → inline SVG icon set
- [ ] Footer rebuild (the "horrendous" one): cleaner column grid, real type scale, no emoji, tightened legal/disclaimer block
- [ ] Seller Hub layout rebuild: action-queue (booking requests + response countdown) as the loud top element, "X of 3 steps to go live" progress checklist, listings grid with status pills, earnings/payout card — `↪ functionality see improvement-roadmap, trust-monetization-sprint`
- [ ] Kill inline-style soup in `seller-hub-panels.tsx` (~44) + `seller-hub-forms.tsx` (~24) → real `mk-` classes
- [ ] Verify every nav/footer/avatar link resolves to a real route (no dead ends)

## Phase B — Account & Settings shell *(PR 2)*

**Why:** there is no account system at all today. This is the shell every
later money/address/notification feature hangs off.

- [ ] `/market/account` route + mode-aware section nav (renter / seller)
- [ ] **Profile** — display name, avatar, public bio
- [ ] **Login & security** — change password, 2FA (SMS/authenticator), active sessions + sign-out-everywhere, login alerts *(Supabase Auth)*
- [ ] **Identity verification** — status surface + honest "confirms identity, not a background check" disclaimer *(reuse existing verify flow)*
- [ ] **Notifications** — email/SMS toggles by category (bookings, messages, payouts, marketing); persist + honor in `lib/market/notify.ts`
- [ ] **Privacy & data** — export my data, delete account
- [ ] **Preferences** — language, currency, timezone

## Phase C — Renter money & addresses *(PR 3)*

**Why:** renters can't save a card or address; every booking re-asks.

- [ ] Saved **payment methods** — Stripe SetupIntent, list/add/remove, set default
- [ ] Saved **addresses** — delivery/pickup, set default, reuse at checkout
- [ ] **Deposits & receipts** — active refundable holds + history with status/release date `↪ deposit engine: master-plan §10`

## Phase D — Seller money surface *(PR 4)*

**Why:** sellers can't see whether they can actually get paid, their
balance, or their tax standing.

- [ ] **Payout status** — surface Stripe Connect `requirements`/`capabilities` as four states (not started → pending → action required → active) `↪ KYC gate: improvement-roadmap #1`
- [ ] **Balance** — pending vs available; payout schedule; payout history
- [ ] **Tax info** — W-9/TIN collection (gates payout); 1099-K download (>$20k & >200 txns, "some states lower")
- [ ] **Fees & earnings** — platform fee (12% seller / 8% operator, $4 min, no fee on deposit holds) + net, per `master-plan` decision record

## Phase E — Discovery & conversion

**Why:** a plain text search + thin PDP leaks revenue; this is the
acquisition + conversion surface. `↪ ranking model: master-plan §22`

- [ ] Search **filters/facets** (category, price, distance, rating) + **sort** + **date-availability-aware** results + real "no results" state
- [ ] **Listing detail completeness** — availability calendar, real-time price breakdown (rate + delivery + deposit + tax), seller response-time, reviews on page, approximate map, "similar items"
- [ ] **Favorites/wishlists** + **saved searches** + **recently viewed** rail
- [ ] **Map/browse** view
- [ ] **SEO** — Product/Offer/AggregateRating JSON-LD on listings + store pages; marketplace sitemap

## Phase F — Trust & safety surface

**Why:** P2P marketplaces live or die on this; reporting/blocking has no
UI today. `↪ moderation ops: master-plan §20–21`

- [ ] **Report/flag** a listing or user + **block user**
- [ ] **Moderation queue** in founder admin (approve/suspend/resolve)
- [ ] **Reviews** — confirm two-sided **simultaneous-reveal** + seller responses; display on profiles/stores
- [ ] **Prohibited-items policy** page `↪ master-plan §26`

## Phase G — Compliance *(high-stakes — verify with counsel)*

**Why:** these are real liabilities that sneak up on marketplaces.
`↪ founder-legal-todo.md`

- [ ] **Marketplace facilitator sales tax** — assess collect-and-remit obligation by state nexus; the platform (not the seller) is often legally responsible
- [ ] **1099-K issuance** — actually generate/file forms, not just collect the W-9
- [ ] **Accessibility (WCAG)** pass on the marketplace surface

## Phase H — Lifecycle & growth

**Why:** retention + acquisition once the core is solid.

- [ ] Move `lib/market/notify.ts` emails onto the editorial email system (they predate the email redesign)
- [ ] Full lifecycle set: booking confirmed, return reminder, deposit released, review request, win-back `↪ reminders exist: improvement-roadmap #3`
- [ ] Referrals / promo codes
- [ ] Mobile/PWA polish (marketplace is mostly phones)

---

## Done log

*(move items here as they ship, with the PR number — same convention as the other trackers)*
