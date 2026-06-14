# Storefront 10/10 — Reviewer Teardown & Editorial Builder Plan

**Created:** 2026-06-14 · **Owner:** founder + Claude · **Status:** analysis complete; execution not started

A full reviewer-grade teardown of the tenant editorial storefront
(`*.korent.app`, the `party-classic` theme), combining a visual review
(founder's screenshots) with a code audit (5 recon passes). Followed by
the plan to turn it into a real editorial **storefront builder**, with a
tier-gating recommendation. **Convention:** `[ ]` todo · `[x]` done · `~` deferred.

> Verdict up front: the *plumbing* is strong (real availability, real
> Stripe-deposit checkout with server-validated pricing, modes/variants/
> add-ons, i18n, per-operator brand injection, a solid mobile menu). The
> gaps that make it "not competitive yet" are concentrated in **visual
> cohesion, conversion chrome, credibility, and a few perf/a11y items** —
> most are small, high-leverage fixes, not a rebuild.

---

## A. Teardown — issues by severity

### P0 — correctness / credibility / legal / core perf

- [x] **"How it works" is on an island (CSS bug, not design).** FIXED in
  G1: deleted the duplicate block (kept the unique `.st-section-link`),
  which restored the centered heading + the symmetric 96px section rhythm
  + the display-serif heading sizes + removed the 760/980 breakpoint
  conflict, site-wide. A duplicate `.st-section-head` block at
  `app/storefront-theme.css:882-911`
  overrides the centered variant's `align-items: center` with
  `align-items: end`, shoving the heading to the right edge while the
  steps stay left. Deleting that legacy block ALSO restores the intended
  symmetric section padding (96px, currently a lopsided 56/40), the
  display-serif heading sizes (32/700 → 40/400), and removes a 760px vs
  980px breakpoint conflict. **One deletion fixes the island + much of
  the global rhythm.** `app/storefront-theme.css:882-911`
- [x] **Hero image ships full-res to phones.** FIXED in G1: hero is now
  `next/image` with `fill` + `sizes="100vw"` + `priority` (optimized,
  responsive srcset). Supabase host is already in `remotePatterns`, so
  operator-uploaded hero URLs optimize too.
- [x] **Brand-color contrast guard is disconnected from the editorial
  theme.** FIXED in G1: `brand-style-injector.tsx` now emits a corrected
  `--st-primary` (the editorial token painted as text/links/borders on
  cream) whenever the operator sets a custom primary. `aaPrimaryOnCream()`
  progressively darkens the brand hue until it clears AA (≥4.5:1) on
  `#F7F4EE`, falling back to editorial ink only if the hue can't clear it.
  `--primary` stays raw (it's a fill behind cream text, e.g. buttons), and
  the derived `--st-primary-dim`/`--st-primary-soft` recompute from the
  corrected value. Olive default already passed, so existing operators are
  unaffected; this only corrects custom colors. (The legacy >0.9 override
  block for `.kicker`/`.nav-links` is kept intact for any non-editorial
  surfaces.)
- [x] **"Made by CrecyStudio" footer credit** — REMOVED entirely
  (`public-footer.tsx`), per founder (it referenced their SaaS-building
  studio and isn't useful). No longer renders on any storefront.
- [x] **Tenant storefronts have no Privacy/Terms footer links.** FIXED
  (Hybrid, founder-confirmed after legal research). Storefront footers now
  always render Privacy + Terms (and an optional Rental Terms/waiver link).
  By default they point to **Korent storefront-baseline pages** written
  from the operator's POV (operator = the business / data controller;
  Korent = software provider / processor) — distinct from Korent's SaaS
  `/privacy`+`/terms`, which only render on the root domain. `/privacy` and
  `/terms` are now tenant-aware: on a storefront they render the baseline
  (or redirect to the operator's own page when set). Operators can override
  all three with their own externally-hosted URLs in **Website settings →
  Legal pages** (`legal_*_url` in `organizations.settings`). Rationale &
  citations: legal-research thread in this session (CalOPPA/CCPA mandate a
  privacy policy once PII is collected; the operator is the controller so
  the pages are theirs to own; FTC junk-fee enforcement + bounce-house
  injury/waiver exposure drive the ToS + waiver fields). **The baseline
  copy in `components/public/legal/storefront-legal.tsx` is a reasonable
  DRAFT — the limitation-of-liability and assumption-of-risk language
  should be reviewed by counsel.** Files: `public-footer.tsx`,
  `app/{privacy,terms}/page.tsx`, `storefront-legal.tsx`,
  `legal-links-form.tsx`, `content-actions.ts` (`updateLegalLinks`),
  `organization-settings.ts` + `settings.ts`.
- [x] **Testimonial stars default to 5.** FIXED in G1: `starString()` in
  `reviews-cards.tsx` now returns "" for a blank/0/invalid rating, and the
  `.st-quote-stars` row only renders for a genuine operator-set rating
  (1–5) — no more fabricated perfect score on the editorial pull-quote.
  This mirrors the dashboard editor (which only shows stars when
  `rating > 0`). The marketplace store page's "Verified-rental reviews"
  (`market/store/[slug]/page.tsx`) was left as-is — those are real ratings
  from completed rentals, not operator-authored. (The fabricated hero
  "5.0 · N reviews" chip was already removed.)

### P1 — competitiveness / conversion

- [x] **Header isn't sticky; desktop CTA is weak.** DONE in G1: sticky
  header (`position: sticky; top:0; z-index:50`) + a real filled desktop
  "Book" button (`.st-nav-book` → /inventory, `m.common.bookNow`) added
  beside the "Inquire" link. (A quote/cart affordance is part of the
  larger no-cart item below, not this one.)
- [ ] **No cart / quote indicator** anywhere in the chrome, despite a
  working checkout. Single-product checkout only — **no multi-item cart**
  (renting a bounce house + tables + tent = three separate checkouts), a
  real gap for party rentals.
- [ ] **PDP has no date picker / availability calendar.** `app/inventory/
  [slug]/page.tsx` reads `date`/`zip` from the URL but offers no way to
  pick them — the core booking gesture is missing on the page where
  customers decide (and where Google/JSON-LD lands them). No customer-
  facing availability calendar exists anywhere.
- [ ] **Deposit amount + delivery info hidden until checkout.** PDP shows
  only "Deposit reserves date" — no amount/%, no "we deliver to your area
  for $X." Competitors lead with "Book for $X deposit."
- [ ] **No trust elements on catalog or PDP** (no ratings/reviews/insured/
  guarantees). Competitive rental PDPs lead with these.
- [ ] **Pricing display is inconsistent.** Cards always say "$X/day"
  (`catalog-list.ts:111-114`) regardless of the product's real model
  (per-hour/per-unit shown correctly only on the PDP) — three different
  price representations across the journey; card sort re-parses the
  formatted string.
- [ ] **Unsplash stock photos are the inflatable fallback** (`storefront-
  fallback-images.ts:13-23`) on cards, PDP hero, AND gallery — the
  classic "this is a template" tell. Worse: inflatable fallbacks are
  Unsplash *photos* while other verticals are SVG gradient panels, so a
  mixed grid shows photos next to flat gradients (inconsistent texture).
  PDP fallback gallery repeats the same image 4×.
- [x] **Featured/"Popular rentals" orphaned heading** — FIXED in G1: the
  whole section is gated on `featured.length > 0`, and the "browse all"
  link only shows at ≥3 products (so tiny catalogs don't read silly).
- [x] **Redundant DB round-trips on every homepage render.** FIXED in G1:
  wrapped `getContentSettings` and `getBrandSettings` in React `cache()`,
  collapsing ~6 duplicate per-render queries to 2.
- [ ] **Fonts via Google `<link>` + `display=swap` → FOUT.** Fraunces +
  Inter Tight load from fonts.googleapis.com (`layout.tsx:122-130`); the
  serif headings flash/reflow on slow connections. Migrate to `next/font`.

### P2 — polish / cohesion

- [ ] **Section rhythm is inconsistent** beyond the duplicate-CSS fix:
  two section-head systems (`SectionHead` vs hand-rolled in category-tiles
  / faq), arbitrary top-rule dividers (how-it-works has one, the featured
  section above it doesn't — fencing it off), inconsistent container
  nesting, and mixed mobile breakpoints (760/980/1024/640).
- [ ] **`viewport.themeColor` is stale orange (`#e8590c`)** vs the olive
  editorial `--st-primary` (`#3F4A33`) — mobile browser chrome tints
  orange on an olive site. `layout.tsx:21`
- [x] **Map pin fallback is old blue** — FIXED in G1: now
  `var(--st-primary, #3f4a33)` (editorial olive) instead of the stale blue.
- [ ] **Undefined `--st-radius-pill`** → square chips/pills
  (`storefront-theme.css:929, 1110`).
- [ ] **Legacy ZIP geocoding loop is sequential** on the client for rows
  without stored coords (`service-area-map.tsx:52-61`) — parallelize.
  (New rows already store coords from the recent map fix.)
- [ ] **Hardcoded English copy** bypasses i18n: hero "Or browse the full
  catalog →" (`hero.tsx:119`), browse-tiles kicker/title, closing headline.
- [ ] **Generic, non-editable PDP boilerplate** — "what to expect" / "best
  fit" are fixed i18n strings identical across all operators
  (`en.ts:1366-1380`); section headings are hardcoded.
- [ ] **PDP hero/thumbnails use raw CSS `background-image`** (not
  `next/image`), thumbnails aren't clickable/lightboxed.
- [ ] **Inconsistent image aspect ratios** (cards 4:5, tiles flip to
  16:11 on mobile, map 4:3) — orientation jumps while scrolling on phones.

### What's already good (don't rebuild)
Real availability + Stripe-deposit checkout with server-validated pricing,
modes/variants/add-ons, idempotency; per-operator brand injection
(colors + 7 Google fonts, scoped so it never leaks into the dashboard);
editable hero text/image, trust badges, testimonials, about, FAQ, footer
contact/social, nav links, service-area data, and per-section visibility;
a solid accessible mobile drawer (focus trap, scroll lock); skip-to-content;
`sanitizeHref` on user URLs; correctly-scoped demo banner (demo-only,
fails closed); product JSON-LD/SEO.

---

## B. The editorial storefront builder — phased roadmap

A lot is already editable. The builder is about (1) finishing the
hardcoded sections, (2) deepening theme control, and (3) adding layout
control — on top of fixing the teardown items above.

- **G1 — De-island + finish the obvious gaps (start here).** Delete the
  duplicate CSS block (fixes island + rhythm); make **How-it-works** and
  **browse-by-occasion** content operator-editable; normalize section
  heads/dividers/spacing; add the Featured empty-state; fold in the quick
  P0/P1 visual fixes (sticky header + real desktop Book button, themeColor,
  map-pin color). High visibility, mostly contained.
- **G2 — Theme depth (live preview).** Expose background/"cream", surface,
  text colors, **typography (heading+body font + scale)**, and corner
  radius in a brand/theme editor with live preview; reconnect the contrast
  guard to the `.st-*` theme. Advanced tokens gated to Pro.
- **G3 — Section builder.** DB-model the page as an ordered list of
  sections (type + config + visibility); drag-to-reorder, add/remove,
  custom content blocks + image blocks. Gated to the top tier.
- **G4 — White-label + power.** ("Made by CrecyStudio" credit already
  removed for everyone; tenant Privacy/Terms footer links already shipped
  as the Hybrid baseline + operator-override — see P0 above.) Remaining:
  optional custom CSS, image galleries/lightbox, multiple theme presets,
  and gating fully-custom legal pages to the top tier if desired.
- **Cross-cutting (anytime):** hero→`next/image`, fonts→`next/font`,
  cache `getContentSettings`/`getBrandSettings`, replace Unsplash defaults
  with branded assets, PDP date picker + deposit/delivery surfacing,
  multi-item cart, consistent pricing display.

---

## C. Tier-gating recommendation

Mirrors the SMB norm (content + basic brand = table stakes; deep theme /
layout / white-label = upsell) and the existing `checkFeatureAccess`
(`lib/stripe/gate.ts`). Founder to confirm exact split.

| Capability | Tier |
|---|---|
| Text/image/testimonials/trust-badges, brand color + font, section show/hide | All tiers (mostly exists) |
| Editable How-it-works + browse tiles; full theme tokens (cream/bg, typography scale, radius); more images | **Pro** |
| Section add / reorder / custom blocks; custom CSS; remove "Made by Korent/CrecyStudio" white-label | **Growth (top)** |

---

## D. Recommended sequencing
Start with **G1** (kills the island + the most visible "unfinished" cues,
contained scope), land the **cross-cutting P0s** (hero image, contrast
guard, white-label credit + tenant legal links) alongside it since they're
credibility/legal, then design **G2/G3** properly (the real "builder" is a
multi-week initiative, not a one-shot). The full P0/P1/P2 lists above are
the backlog to check off.
