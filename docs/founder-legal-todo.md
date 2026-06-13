# Founder Legal To-Do — Komlan's reminder list

**Created:** 2026-06-13 · things only YOU can do (not code). Full
research + rationale: `docs/marketplace/legal-stack.md` and
`docs/marketplace/trust-monetization-sprint.md`. None of this is legal
advice — it's the prepared homework that makes the attorney hour cheap.

---

## Do this week

- [ ] **Create the `legal@korent.app` mailbox** (Resend/Google
  Workspace alias is fine). The live Terms already point arbitration
  notices, arbitration opt-outs, and DMCA notices there — mail sent
  there today goes nowhere.
- [ ] **Register a DMCA agent**: copyright.gov/dmca-directory → $6,
  ~1 hour, register under the LLC. This is what gives you the legal
  safe harbor when a user uploads someone else's photos. **Calendar
  the renewal: it expires every 3 years and an expired registration
  forfeits the safe harbor.**
- [ ] **Form the LLC if not done** (Virginia home-state filing was the
  recommendation — cheapest, no foreign-qualification overhead). The
  Terms say "Commonwealth of Virginia" and the DMCA/1099 items hang
  off the entity. S-corp election is a LATER optimization (~$50–80k
  annual profit).
- [ ] **Set `PLATFORM_ADMIN_EMAILS`** in Vercel (your email) — not a
  legal item, but the dispute queue you're legally promising to run
  ("resolve simple disputes within 72h" is in the Terms) is invisible
  until you do.

## Before real launch volume

- [ ] **One attorney sitting** to review, as a package:
  `/market/terms` (the release, liability cap, indemnification, and
  arbitration sections are state-specific), the privacy policy, and —
  when Phase 6 ships — the generated rental-agreement template.
  Everything is drafted from real product behavior, so this should be
  a review, not a rewrite.
- [ ] **Business insurance quote**: general liability + cyber for the
  platform entity itself (this protects Korent the company; it is NOT
  the renter/seller insurance question, which the Terms correctly
  push to the users).
- [ ] **Sales-tax registrations** for the states where the
  marketplace facilitates rentals (DC/MD/VA at launch — the code
  already computes and collects facilitator tax; registration is the
  paper side).

## Every year / calendared

- [ ] **January: 1099-K filings.** Under our Stripe destination-charge
  setup, KORENT (not Stripe) is the filer for sellers crossing the
  thresholds — federal >$20k AND >200 transactions, but **VA and MD
  use ~$600 state thresholds**, so this bites early. Enable Stripe's
  1099 e-file product before your first January with payouts.
- [ ] **DMCA agent renewal** (every 3 years from registration).
- [ ] **Annual skim of the Terms** against the product — the lawsuits
  in our research (Home Depot) come from drift between what documents
  say and what the code charges.

## Trigger-based (do nothing until the trigger fires)

- [ ] **~35,000 Maryland users** → Maryland MODPA compliance build-out
  (data-rights request process, assessments). Lowest threshold in the
  country and it's in our launch metro — watch this one first.
- [ ] **~100,000 users in any state or $26M+ revenue** → CCPA/VCDPA
  class of privacy laws.
- [ ] **Before serving Washington state** → counsel review (WA treats
  facial photos as regulated biometric data even without face
  recognition; private right of action).
- [ ] **Before adding ANY face-recognition / ID-verification vendor**
  → counsel review. Our entire BIPA/CUBI safety rests on "a human
  compares the photos; no biometric templates" — a vendor that
  extracts face geometry silently breaks it.
- [ ] **Before offering a Turo-style protection plan / damage
  waiver** → insurance-regulatory counsel (must stay "contractual
  risk allocation," never "insurance," or state insurance licensing
  triggers).
- [ ] **If a SALES lane ever ships** (not rentals) → INFORM Consumers
  Act review at 200+ new-item sales/$5k per seller.
- [ ] **If anyone invokes arbitration** → pay Korent's share of the
  AAA fees promptly (Turo got a class action for stalling on exactly
  this).

## The never-do list (product constraints with legal teeth)

- Never run face recognition or extract face geometry from ID/selfie
  photos (BIPA/CUBI line — currently our strongest shield).
- Never let rental money touch a Korent bank account — 100% through
  Stripe Connect rails (money-transmitter licensing avoidance).
- Never possess, store, ship, inspect, or certify rented items
  (product-liability "pure venue" posture — Bolger v. Amazon).
- Never claim "verified/safe/guaranteed" beyond what's implemented
  (Getaround's $950k fine), and never put promo content in an OTP or
  notification text (TCPA reclassification).
- Never change a fee without changing the disclosed formula in the
  same deploy.
