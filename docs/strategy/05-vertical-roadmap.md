# 05 — Vertical Roadmap & Demand Research

> **⚠️ AMENDMENT — June 5, 2026**
>
> The original recommendation below (lock inflatables as #1, build vehicles & fleet as #2) has been **superseded** for the current sprint. The new direction is to expand *within* the party-rental umbrella instead of pivoting to a new industry:
>
> **Build 5 party sub-verticals using a capabilities-based architecture:**
> 1. Tents & canopies
> 2. Tables & chairs
> 3. Dance floors & staging
> 4. Photo booths
> 5. Concessions
>
> Rationale: the existing inflatable customer base overwhelmingly also rents at least one of these five (verified via Goodshuffle Pro / TapGoods / Booqable "industries served" pages). Expanding within the party umbrella captures more of the same customer wallet without building a second domain model. Vehicles & fleet is **deferred indefinitely** — revisit only if a clear vehicle-rental customer demands it.
>
> **Authoritative doc for the new direction:** [`docs/architecture/multi-vertical-capabilities.md`](../architecture/multi-vertical-capabilities.md). That doc is the engineering source-of-truth for capabilities, schema migrations, phased plan, per-vertical gap analysis, and parked decisions (Tier C: linens / bar equipment / games / generators / restrooms / wedding decor / AV).
>
> The content below is preserved as historical context — it remains accurate as a *June-2026-pre-pivot snapshot* of the 12-vertical demand-vs-competition audit and is useful when re-evaluating deferred verticals.

---

**Date:** June 2026
**Purpose:** Decide which rental verticals to ship in the Korent onboarding chooser, in what order, and with what build effort. Replaces the earlier blanket "primary vertical: party/event rental" decision with vertical-by-vertical readiness scoring and a US market-demand analysis.

This doc combines two pieces of research:

1. **Capability audit** — what already exists in the codebase, broken into vertical-generic infrastructure vs. vertical-specific assumptions
2. **Demand-vs-competition research** — US market sizing, growth rate, search volume, SaaS competitor density, and operator fragmentation across 12 candidate rental verticals

The conclusion is operational: **inflatables & party rentals stay the #1 vertical until launch is 99% clear; vehicles & fleet (independent/exotic/luxury/P2P) is the recommended #2 vertical to build**.

---

## 1. Capability audit

### Vertical-generic (works for any rental today)

| Capability | Files |
|---|---|
| Catalog, inventory, availability calendar | `lib/availability/`, `lib/data/catalog-list.ts` |
| Order taking, deposits, payment recording, multi-day rentals (`rental_end_date` + `rental_days`) | `lib/orders/`, `lib/payments/`, migration `20260513_010000` |
| Delivery + pickup logistics, Mapbox route optimization, smart-delivery mode | `lib/routes/`, `app/api/routes/` |
| Crew workspace (mobile today page, photo upload, signature pad, before/after condition photos) | `app/crew/`, `components/crew/`, migration `20260604_010000` |
| Customer portal (status lookup, document download, balance pay) | `lib/portal/`, `components/portal/` |
| QuickBooks Online + Xero sync | migrations `20260603_040000`, `20260603_060000`, `lib/quickbooks/`, `lib/xero/` |
| WhatsApp Business + SMS + email | `lib/communications/`, `lib/sms/`, `lib/whatsapp/` |
| Recurring booking series | `lib/orders/series.ts` |
| E-sign waivers + per-vertical T&C PDF generation | `lib/documents/generate-pdf.ts` |
| Storefront, public booking, multi-tenant slug subdomains | `app/[slug]/`, `lib/storefront/` |
| Roles (owner/admin/dispatcher/crew) | RLS policies in supabase migrations |
| Weather alerts (wind/temp/rain for event dates) | `lib/weather/` |

### Vertical-specific (already wired for 3 verticals)

| Surface | Inflatable | Car | Equipment |
|---|---|---|---|
| Default seed categories | Bounce House, Water Slide, Combo Unit, Obstacle Course, Game | Economy, SUV, Truck, Luxury, Van | Generators, Lifts, Compressors, Trailers, Tools |
| Rental agreement T&Cs | Wind/lightning shutdown, anchored on level ground, 100ft of outlet | Authorized drivers, fuel policy, tolls/violations, geographic limits, return condition | Qualified operators, compliance, pre-use inspection |
| Safety waiver | Assumption of risk, adult supervision, capacity limits | (none yet) | (none yet) |
| Sidebar navigation filter | Vertical-aware via `lib/navigation/dashboard-nav.ts:73-77` | Same | Same |

### Inflatable assumptions hardcoded in copy

- Onboarding chooser description text
- Storefront copy ("Find the right party setup faster" etc.)
- Demo catalog product names (Castle Bouncer, Mega Splash, Tropical Combo)
- Marketing pages ("from your first bounce house to your hundredth booking")

### What's missing per vertical (audit gap list)

**Vehicles & fleet:**
- Mileage start/end capture (crew app photo or manual entry)
- Fuel level photo capture
- VIN, driver license verification, insurance proof upload
- Tolls/fines reconciliation
- Damage code taxonomy + hotspot photo annotation

**Heavy equipment:**
- Runtime hours tracking
- Operator certification (cert file upload + verification)
- Maintenance/inspection checklist on return
- Attachments inventory per unit
- Fuel meter capture

**Tents/events, A/V, furniture, camera, etc.** — gap lists detailed in scorecard below.

---

## 2. Vertical readiness scorecard

Score 1-10. Build days estimate the engineer-time from "today" to a credible 10/10 vertical experience (workflows, copy, fields, seed data, T&Cs, demo catalog). Buckets group similar effort tiers.

| # | Vertical | Score | Top blockers | Build days | Bucket |
|---|---|---|---|---|---|
| 1 | **Inflatables & party** | 10 | None — live and production-ready | 0 | **A — Ship now** |
| 2 | Tents & wedding/event | 7 | Wind-load T&Cs, guest-capacity field, multi-day all-inclusive vs per-day billing | 3-4 | B — 1-2 weeks |
| 3 | Event furniture | 6 | Per-item inventory tracking, linen/dishware damage workflow, return reconciliation | 4-5 | B — 1-2 weeks |
| 4 | Audio/visual | 7 | Per-item checkout sheet, power-spec notes, technician-as-stop-assignee | 3-4 | B — 1-2 weeks |
| 5 | **Vehicles & fleet** | 5 → 8 after build | Mileage + fuel capture, license verification, damage code taxonomy | 5-6 | B — 1-2 weeks |
| 6 | Heavy equipment | 5 | Runtime hours, operator cert verification, maintenance checklist | 6-8 | C — 3-6 weeks |
| 7 | Power tools & light construction | 5 | Safety cert capture, per-tool condition checklist, operator attestation | 5-7 | B — 1-2 weeks |
| 8 | Portable sanitation | 3 | Per-unit GPS location, mid-event service calls, double-booking detection — breaks order/route model | 8-10 | C — 3-6 weeks |
| 9 | E-mobility (bikes/scooters) | 4 | GPS unit recovery, battery state capture, serial-# attestation | 6-8 | C — 3-6 weeks |
| 10 | Watercraft | 4 | State-by-state Coast Guard waiver, marine insurance, tow-vehicle detection | 5-7 | C — 3-6 weeks |
| 11 | Camera/photo/film gear | 6 | Per-item damage codes, serial-# tracking, refund holds on damaged gear | 4-5 | B — 1-2 weeks |
| 12 | Moving/storage/containers | 7 | Moving-specific T&Cs (weight limits, ground prep), weight input, delivery-window choreography | 3-4 | B — 1-2 weeks |

---

## 3. Market research — demand vs. competition (US, 2025-26)

Synthesis from 5 parallel research streams (IBISWorld, ARA, US Census, Mordor, Statista, vendor pricing, Ahrefs/Semrush, Google Trends). Full source list at bottom of section.

### Vertical demand summary

| # | Vertical | TAM (US) | Growth | Operator density | SaaS saturation | Search demand |
|---|---|---|---|---|---|---|
| 1 | Inflatables & party | ~$1.76B NA | +5.8% CAGR | Fragmented (top 4 = 9%) | Moderate (6 — InflatableOffice + ERS dated) | ~120k/mo, rising +20% |
| 2 | Tents & wedding | Slice of $5.3B ARA event rental | +3.8% | Fragmented mom-and-pop | **Hyper-saturated** (12+, Goodshuffle raised $5M 2024) | ~58k/mo, flat-rising |
| 3 | Event furniture | $5.9B P&F bucket | Flat | Fragmented | Saturated (8, stack overlaps tents) | ~65k/mo, flat |
| 4 | Audio/visual | $10.6B (large) | +7.5% | Consolidated upstream (PSAV/Encore), fragmented local | 6 deep specialists (Flex, IntelliEvent, Rentman) | ~9k/mo |
| 5 | Vehicles & fleet (indep/exotic/P2P) | $8.4B P2P slice | **+11.6% CAGR** | Fragmented (Turo platform aside) | 5 (Wheelbase mid-tier biggest) | ~80k/mo, rising |
| 6 | Heavy equipment | $57.7B | +1.5% | Consolidated top (United/Sunbelt/Herc), fragmented tail | 7 (Quipli/Texada gaining among independents) | ~90k/mo, flat |
| 7 | Power tools | $5.7B | +2.6% | Fragmented (no firm >5%) | 5 (Quipli leads modern) | ~60k/mo, falling slightly |
| 8 | Portable sanitation | $3.3B | +1.7% | Fragmented (3,732 operators) | 6 (**ServiceCore dominates**, thousands of operators) | ~226k/mo (dumpster-led) |
| 9 | E-mobility | $5.53B | **+15.14% CAGR** | Consolidated fleets (Lime/Bird/Spin), fragmented shops | 4 (Joyride, Movatic, ATOM, Comodule) | ~110k/mo, rising |
| 10 | Watercraft | $5.3B | +3% | Fragmented (9,005 operators, no firm >5%) | 4 thin (RentMy, SpeedyDock) | **~340k/mo**, rising +30% peak |
| 11 | Camera/photo/film | $3.2B global (US ~59%) | +6.7-8.6% | Fragmented (no firm >5%) | Thin (3, mostly marketplace) | ~40k/mo, flat-falling |
| 12 | Moving/storage/containers | ~$4B | +6.6% | Consolidated giants (PODS, Mobile Mini, U-Haul) | 1-2 (mostly captive proprietary) | ~58k/mo, flat |

### "Build-this-next" composite score

Combining demand × growth × competition × SaaS conversion gap × architectural fit with Korent's existing stack:

| Rank | Vertical | Score | One-line rationale |
|---|---|---|---|
| 🥇 1 | **Inflatables & party** | 9 | Already 10/10 ready. Existing competition (InflatableOffice/ERS) is dated 2010s software — that's the moat. Don't drift. |
| 🥈 2 | **Vehicles & fleet** (independent/exotic/luxury) | 7 | Fastest-growing segment (+11.6% CAGR), $8.4B P2P TAM, fragmented operators who hate Turo's cut, beatable SaaS competition (Wheelbase is mid-tier UX), 90% architectural fit with Korent's existing delivery/pickup/photo/signature stack. ~5 engineer-days to ship credibly. |
| 🥉 3 | Camera/photo/film gear | 7 | Highly fragmented owner-operator market, thinnest SaaS competition (3 players, mostly marketplace not B2B), ShareGrid/Kit's 20% commission is the wedge. Smaller TAM and flat-falling search trend make it a sleeper bet, not first priority. |
| 4 | Heavy equipment | 6 | Massive TAM ($57.7B) but Quipli (2020-founded, modern noob-first play) already owns the independent yard segment. Korent would enter as follower. |
| 5 | Power tools | 6 | Fragmented but small TAM ($5.7B) and falling search. Quipli is the modern player to beat. |
| 6 | Event furniture | 5 | Moderately saturated, flat growth, depends on bundling with tents. |
| 7 | Portable sanitation | 5 | ServiceCore literally owns this vertical. Service-call workflow breaks Korent's order-once paradigm. |
| 8 | E-mobility | 5 | High CAGR but fleet share is captive (Lime/Bird won't switch). Local shops fragmented but mostly already on Booqable. |
| 9 | Tents & wedding | 4 | Hyper-saturated — 12+ SaaS competitors, Goodshuffle just raised $5M. Korent enters as #13. |
| 10 | Audio/visual | 4 | Pro-AV is owned by Flex/IntelliEvent (deep workflow incumbents). Local DJ TAM small. |
| 11 | Moving/storage/containers | 3 | Consolidated by giants with proprietary software. Small independent market. |
| 12 | Watercraft | 8 raw, 5 adjusted | Highest demand signal (~340k searches, +30%), fragmented, SaaS thin. **But** 70-80% of revenue in 5 summer months (cashflow brutal) + state-by-state Coast Guard / marine insurance regulatory rabbit hole. Adjusted down for solo-founder feasibility. Revisit when Korent has 3+ employees. |

### Why NOT the obvious picks

- **Watercraft** has the biggest raw demand signal in the table, but the seasonality (5 months/year of revenue) and state-by-state marine insurance regulation make it 2-6x the build effort and operationally hostile to a bootstrapped founder. Defer.
- **Tents & wedding** looks like a natural adjacency to inflatables, but **12+ funded SaaS players are already there** (Goodshuffle, Point of Rental, Alert, IntelliEvent, ERS, TapGoods, Curate, Rentman, Current RMS, Booqable, Rentopian, HoneyBook-adjacent). Differentiation requires a unique workflow wedge, not just price.
- **Portable sanitation** has the highest raw search volume after watercraft, but **ServiceCore owns it** and the service-call/route-optix model is a different architecture entirely.
- **Heavy equipment** is huge ($57.7B) but **Quipli is the modern noob-first incumbent**. Korent would be a copycat.

### Sources

Detailed citations in the research transcript stored at session `01W9BK9BYoTWdj1eQkKAp9MJ`. Key sources:

- IBISWorld reports 1378 (Heavy Equipment Rental), 1376 (Tool Rental), 4716 (Portable Sanitation), 4389 (Party Supply), 6234 (Audio Visual), 1363 (Car Rental), 6472 (Boat Rentals), 5529 (Mobile Storage), 5745 (Motion Picture Equipment), 53229 (Party & Event), 53241 (Heavy Equipment)
- ARA Q4 2025 Forecast — `ararental.org`
- US Census NAICS 532412, 532289, 562991
- Mordor Intelligence — Bike & Scooter Rental 2025
- Statista — Construction Equipment Rental Market Share 2022
- Grand View Research — US Boat Rental
- Verified Market Reports — Camera Equipment Rental
- Quipli 2025 State of Rental
- Vendor pricing pages — Booqable, Goodshuffle Pro, Rentle, EZRentOut, Point of Rental, Alert Rental, InflatableOffice, Event Rental Systems, IntelliEvent, Wheelbase Pro, ShareGrid, TapGoods, Curate
- Ahrefs/Semrush public previews + Google Trends + SEO blog citations (Quipli, Clicks Geek, Marketkeep, Treendly, Buoy, Booqable blog)

---

## 4. Decisions

### Decision A — Inflatables & party rentals: lock in as the #1 vertical until launch is 99% ready

**Rationale:**
- Codebase is already 10/10 ready
- The competition (InflatableOffice, Event Rental Systems) ships dated 2010s software — that's Korent's real moat
- Rising search demand (+20% YoY on "bounce house rental")
- Fragmented operator market (top 4 = 9% share) = massive long-tail SaaS TAM
- Korent's existing strengths (delivery, crew, customer portal, WhatsApp, accounting sync, photo proof) align perfectly with this vertical's workflow

**Next action:** Q&A pass to identify any remaining gaps before public launch. Track in `docs/INFLATABLE_LAUNCH_READINESS.md` (to be created in the next slice).

### Decision B — Vehicles & fleet: build as the #2 vertical AFTER inflatables ships

**Rationale:**
- Fastest-growing segment in the table (+11.6% CAGR on $8.4B P2P)
- Fragmented operator market — Turo dominates discovery but operator SaaS is openable (hosts hate Turo's 15-40% commission)
- Beatable competition — Wheelbase ($150/mo + insurance kickback) is mid-tier UX, RENTALL and HQ Rental are quote-only enterprise
- **90% architectural fit with Korent's existing stack** — delivery + pickup + before/after condition photo + signature + crew app are all already a match for vehicle handoff
- Existing groundwork: T&Cs already drafted (`lib/documents/generate-pdf.ts:35-44`), category seeds wired (`20260513_010000:65-79`), and `CAR_RENTAL_EXPANSION_MASTER_PLAN_V2.md` already exists at repo root with architectural depth
- Estimated 5-6 engineer-days to ship credibly (mileage capture, fuel meter, license verification, damage codes)

**Out of scope until validated demand:** vehicle insurance integration, state-DMV API, peer-to-peer marketplace features. Start with the operator-runs-own-fleet model.

### Decision C — All other verticals: deferred

Specifically:
- **Tents, A/V, event furniture, camera/photo/film, moving/containers, power tools** — in Bucket B (1-2 weeks each) but no clear strategic case to build before validating vehicles & fleet
- **Heavy equipment** — Bucket C, Quipli is the incumbent
- **Watercraft, E-mobility, Portable sanitation** — Bucket C/D, architectural mismatch or regulatory blocker
- All of the above remain options if Korent reaches 50+ paying inflatable customers and wants to expand horizontally

### Decision D — Onboarding chooser scope

Currently the chooser exposes `inflatable / car / equipment`. The audit shows car and equipment are at 5/10 — operators picking them today get partial experiences.

**Interim posture:** keep the chooser as-is. The marketing site, sales pages, and content marketing should target **only** inflatable operators until vehicles & fleet ships. Car/equipment are not removed from the chooser because some prospects find Korent via SEO for those terms, but they will not be marketed-to as supported verticals.

**Follow-up code change** (not blocking, do as small PR):
- Fix the chooser label "Inflatables & party rentals" — current description says "tables, chairs, party gear" which the inflatable T&Cs don't support. Tighten to "bounce houses, water slides, combo units, obstacle courses, party games"

---

## 5. Related docs

- `COMPETITIVE_POSITIONING_MASTER_PLAN.md` — sprint-level execution plan (Sprints 1-5.8 complete as of June 2026)
- `CAR_RENTAL_EXPANSION_MASTER_PLAN_V2.md` — pre-existing architectural plan for the vehicles & fleet vertical (V2 layer-separation approach)
- `docs/strategy/02-competitive-analysis.md` — earlier Goodshuffle Pro / Booqable / InflatableOffice audit
- `docs/strategy/04-gtm-and-positioning.md` — go-to-market plan (inflatable-focused)
- `docs/FEATURE_VALIDATION_CHECKLIST.md` — feature-level QA tracking

---

## 6. Confidence flags

| Claim | Confidence | Notes |
|---|---|---|
| Inflatable competition (InflatableOffice, ERS) is dated 2010s software | **High** | Confirmed via prior vendor audit in `02-competitive-analysis.md` |
| Vehicles & fleet P2P TAM is $8.4B with +11.6% CAGR | **Medium** | Dataintelo source; triangulates with IBISWorld but P2P-specific data is thin |
| Watercraft search demand is ~340k/mo combined | **Medium** | Public Ahrefs preview + Booqable blog; gated tools couldn't be verified end-to-end |
| Build-day estimates per vertical | **Medium-Low** | Based on the gap audit, not measured against past sprint velocity — treat as ±50% range |
| ServiceCore dominance in portable sanitation | **High** | Confirmed via their site claim of "thousands of operators" and IBISWorld fragmentation data |
| Goodshuffle just raised $5M and is the dominant tents/events SaaS | **High** | TechCrunch 2024 |
