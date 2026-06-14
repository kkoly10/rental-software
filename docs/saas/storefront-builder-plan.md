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

- [ ] **"How it works" is on an island (CSS bug, not design).** A
  duplicate `.st-section-head` block at `app/storefront-theme.css:882-911`
  overrides the centered variant's `align-items: center` with
  `align-items: end`, shoving the heading to the right edge while the
  steps stay left. Deleting that legacy block ALSO restores the intended
  symmetric section padding (96px, currently a lopsided 56/40), the
  display-serif heading sizes (32/700 → 40/400), and removes a 760px vs
  980px breakpoint conflict. **One deletion fixes the island + much of
  the global rhythm.** `app/storefront-theme.css:882-911`
- [ ] **Hero image ships full-res to phones.** Hero is a raw `<img>`
  (`hero.tsx:57-63`), 2400×1500, `fetchPriority="high"` but **no `sizes`/
  srcset** and not `next/image` — a 360px phone downloads the 2400px
  asset (worst on car-screen/cellular, the founder's demo context).
- [ ] **Brand-color contrast guard is disconnected from the editorial
  theme.** `brand-style-injector.tsx:49-67` only corrects colors with
  luminance > 0.9 and emits overrides for legacy classes (`.kicker`,
  `.nav-links a`) that don't exist in the `.st-*` theme. A mid-bright
  brand color renders as small text/links on `#F7F4EE` cream with no
  enforced 4.5:1 — the WCAG safety net was never reconnected after the
  editorial rebuild.
- [ ] **"Made by CrecyStudio" footer credit shows on every paying
  operator's storefront and can't be removed.** Rendered unconditionally
  (`public-footer.tsx:148`), outside the `!isTenant` guard. A paying
  operator can't hide a third-party backlink on their own domain —
  white-label defect.
- [ ] **Tenant storefronts have no Privacy/Terms footer links.** They
  render only on the SaaS root domain (`public-footer.tsx:142-147`), so a
  live site taking bookings + payments shows no legal links.
- [ ] **Testimonial stars default to 5.** `reviews-cards.tsx:56-59`:
  a blank/0 rating renders a full 5-star row, and stars sit above the
  quote reading as an aggregate rating — self-reported social proof.
  (The fabricated hero "5.0 · N reviews" chip was already removed.)

### P1 — competitiveness / conversion

- [ ] **Header isn't sticky; desktop CTA is weak.** `.st-header` has no
  `position: sticky` (`storefront-theme.css:339-342`) — nav + CTA scroll
  away on a long page. The desktop CTA is an underlined "Inquire" text
  link; the real "Book Now" button exists **only in the mobile drawer**
  (`mobile-menu-toggle.tsx:238`). No persistent book/quote affordance.
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
- [ ] **Featured/"Popular rentals" renders an orphaned heading with no
  empty state** when there are no featured products (`app/page.tsx:115-138`).
- [ ] **Redundant DB round-trips on every homepage render.**
  `getContentSettings` (uncached) is called ~5× (page, trust-strip,
  reviews-cards, footer, …) and `getBrandSettings` 2×. Wrap both in
  React `cache()` like their siblings. `content-settings.ts:52`, `brand.ts:19`
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
- [ ] **Map pin fallback is old blue** (`var(--primary, #2563eb)`,
  `service-area-map.tsx:130`) — blue pins on a warm palette when no brand
  override is set.
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
- **G4 — White-label + power.** Remove the "Made by CrecyStudio" credit
  on top tier (and add Privacy/Terms to tenant footers for everyone),
  optional custom CSS, image galleries/lightbox, multiple theme presets.
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
