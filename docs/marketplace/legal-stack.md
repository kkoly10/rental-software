# Legal Stack — Plan & Drafting Tracker

**Created:** 2026-06-12 · **Owner:** founder + Claude · **Status:** drafting

The lawsuit-protection layer, grounded in the 2026-06-12 research pass
(arbitration case law, platform ToS analysis, e-sign law, fee
litigation) plus a privacy/regulatory pass. Everything drafted here is
**a draft for one attorney review pass — not legal advice**; the
research's clearest lesson (Home Depot, Getaround) is that the gap
between what documents say and what the product does is where
lawsuits live, so each document below is written FROM the
implemented product behavior.

---

## Current state (audited 2026-06-12)

- `/terms` and `/privacy` exist but cover the **SaaS only** ("rental
  management platform"). No arbitration clause, no class waiver, no
  marketplace coverage at all.
- The marketplace (rent.korent.app) redirects /terms → app domain, so
  renters consent to SaaS-only terms at signup. **Nothing governs the
  renter↔seller relationship, deposits, claim windows, late fees,
  evidence rules, or disputes.** This is the gap.
- Privacy policy never mentions: ID photos, live selfies, phone
  numbers/SMS OTP, marketplace messages, condition photos, demand
  capture emails.

## Document inventory (the stack)

| # | Document | Where | Status |
|---|---|---|---|
| 1 | Marketplace Terms of Service (participation agreement: renters + sellers) | `/market/terms` on rent.korent.app | **DRAFT BELOW — highest priority** |
| 2 | Privacy Policy v2 (covers both surfaces + marketplace data) | `/privacy` (shared) | DRAFT NEXT |
| 3 | Generated Rental Agreement template (per-booking packet) | Phase 6 of build tracker | designed, builds with contracts |
| 4 | SaaS Terms (existing) | `/terms` | keep; add arbitration § in the same pass |
| 5 | Community / prohibited-items policy | exists in registry (restricted-items); surface as page | LOW |
| 6 | DMCA agent + policy | pending research verdict | TBD |

## What the Marketplace ToS must contain (research-grounded)

1. **Venue framing (Peerspace/RVshare pattern):** Korent is a
   marketplace; each booking forms a binding agreement BETWEEN renter
   and seller incorporating the listing, these terms, and (Phase 6)
   the generated rental packet. Korent is not a party to the rental,
   not a lessor, not an insurer.
2. **Money terms stated exactly as computed (Home Depot rule):**
   platform fee (seller-paid; renters pay no service fee), late fees
   (daily rate + $20/started day, 3-day cap, 2h grace — then treated
   as non-return), cancellation tiers by risk family, deposits
   (authorization near handoff; captured ONLY through dispute
   resolution; never insurance), facilitator sales tax.
3. **Evidence ceremony + claim windows (the locked flow):** seller
   before-photos required to hand off; renter pickup (≤4h) and return
   (≤24h) photo windows; 24h post-completion claim window; the
   presumption ladder. Stated in terms = enforceable expectations.
4. **Identity verification described precisely (Getaround rule):**
   what we verify (gov ID + selfie reviewed at handoff; seller payout
   KYC via Stripe) and what we don't (no background checks).
5. **Assumption of risk / AS-IS / release** for peer-to-peer
   transactions; limitation of liability (cap tied to fees paid);
   indemnification; no warranty on peer-supplied items.
6. **Off-platform circumvention prohibition** (matches the moderation
   engine that already enforces it).
7. **Prohibited items** (the restricted-items registry, by reference).
8. **UGC license** (listing photos, reviews, messages) + review
   integrity rules.
9. **ARBITRATION § (conspicuous, all-caps headed):**
   - Binding INDIVIDUAL arbitration, AAA Consumer Arbitration Rules;
     FAA governs (Airbnb §23 pattern — upheld in Selden v. Airbnb).
   - **Small-claims carve-out** (either party).
   - **30-day individualized pre-arbitration notice** requirement.
   - **Class action + jury trial waiver** (separately conspicuous).
   - **30-day opt-out right** by email — strengthens enforceability.
   - **Mass-arbitration batching** (Airbnb's batches-of-200 model) —
     the modern clause anticipating mass-filing campaigns.
   - **Trifan v. Turo lesson:** if we mandate arbitration we MUST pay
     our share of fees when invoked, or the clause becomes a class
     action about the clause.
10. **Assent per Meyer v. Uber:** signup keeps the uncluttered screen,
    blue underlined terms link adjacent to the button, "By creating an
    account, you agree…" — and we retain WHICH terms version was
    accepted (timestamp + version hash) per ESIGN/UETA retention.
11. **Electronic-transactions consent** (ESIGN): users consent to
    receive records electronically.
12. Governing law: Virginia (founder's home-state LLC), subject to
    consumer-protection carve-outs.

## Privacy & regulatory findings (research pass 2026-06-12)

- **FTC Act §5 is the floor at any size:** the policy must ACCURATELY
  describe actual practice — a copied/aspirational policy is worse
  than a sparse accurate one (Everalbum/Paravision: retained ID data
  past stated purpose → consent decree). SHIPPED: privacy v2 covers
  the marketplace data inventory.
- **ID/selfie photos stay outside BIPA/CUBI ONLY because no face
  geometry is ever extracted** — photographs are excluded from
  "biometric identifier" absent template extraction. NEVER add a
  face-recognition vendor without counsel; the no-biometrics statement
  is now in the policy and is a product constraint, not just copy.
  Washington (MHMDA) treats facial photos as in-scope regardless —
  counsel review before serving WA users.
- **Maryland MODPA is the binding-soonest law** (35,000 MD consumers —
  lowest threshold in the country, in our launch metro; sensitive data
  only when "strictly necessary," never sold). Design posture adopted
  now; DSAR build-out triggers at ~35k MD users. CCPA/VCDPA/CO/CT/OR
  bind at ~100k consumers or $26M+ revenue — monitor only.
- **TCPA:** OTP + rental notifications need prior express consent —
  satisfied by the consent line now under the phone field. Marketing
  SMS would need separate written consent (don't add without it).
  Never mix promo content into a transactional text.
- **CAN-SPAM:** transactional email exempt; marketing email needs
  postal address + working unsubscribe. Streams already separated.
- **Section 230** shields us for user content (listings, reviews,
  messages — Daniel v. Armslist) but NOT for our own statements
  (badges, "verified" copy — already fixed in Phase 0) nor for
  transaction-based liability (HomeAway v. Santa Monica).
- **Bolger v. Amazon (product liability) avoidance:** never possess,
  store, ship, inspect, or certify items; pure-venue posture is the
  shield. The Condition Proof feature must stay seller-demonstrated.
- **INFORM Consumers Act: does not apply** (sales statute; rentals
  aren't sales of new products). Revisit only if a sales lane ships.
- **1099-K:** under destination charges THE PLATFORM is the filer
  (federal threshold >$20k AND >200 txns; VA/MD use ~$600 state
  thresholds). Use Stripe's 1099 product; W-9/TIN comes with Stripe
  onboarding.
- **Money transmission:** avoided so long as 100% of rental money
  stays on Stripe Connect rails — never route funds through a Korent
  bank account, never accept off-platform repayment for sellers.

## Founder action items (not code)

- [ ] **Attorney review pass** on /market/terms (release, cap,
  indemnity, arbitration package) — one sitting, state-specific.
- [ ] **Register DMCA agent** at copyright.gov/dmca-directory ($6,
  ~1 hour) under the LLC; calendar the 3-year renewal. The ToS DMCA
  section is already live.
- [ ] **Create legal@korent.app** (arbitration notices, opt-outs,
  DMCA) — referenced by the live terms.
- [ ] **Enable Stripe 1099 e-file** before the first January with
  seller payouts; check VA/MD/DC state thresholds.
- [ ] If a Turo-style protection plan is ever offered: insurance-
  regulatory counsel FIRST (contractual risk allocation framing).

## Status

1. [x] Marketplace ToS — SHIPPED at /market/terms (rent.korent.app/terms
   now resolves there; renter signup assent strengthened to Meyer
   wording naming the arbitration agreement).
2. [x] Privacy v2 — SHIPPED at /privacy (marketplace data inventory,
   ID/selfie no-biometrics statement + retention, SMS consent, Anthropic
   subprocessor disclosure).
3. [x] TCPA consent line under the phone field.
4. [ ] SaaS ToS arbitration § (same clause, adapted) — next pass.
5. [ ] Automated ID/selfie deletion on account-deletion request (code;
   policy states 30 days — implement before first deletion request).
6. [ ] Attorney review (founder action above).
7. [ ] Rental-agreement packet ships with Phase 6 and inherits the
   money/evidence language verbatim.
