# Korent Editorial — Storefront Design Specification

**Status:** SHIPPED — this document now describes the as-built system. Sections amended after launch are marked **[as-built]**; see §11 for the revision log mapping every change to its PR.
**Mockup:** `reference/mockups/Korent Editorial (proposal).html` (open in any browser; images embedded inline). The mockup shows the original asymmetric-hero proposal; the shipped hero is full-bleed (§5.2).
**Scope:** The default tenant storefront homepage at `app/page.tsx`, the catalog index at `app/inventory/page.tsx`, the shared header/footer, and the shared product card. All operator-customizable knobs (brand color, brand font, hero image, headline text, content section visibility) continue to work — this rebuild changed the **defaults** and the **design language**, not the override surface.

---

## 1. Goal & non-goals

### Goal
A default tenant storefront that reads as **trusted, high-end, professional** for every Korent vertical — inflatables, tents, photo booths, concessions, tables & chairs, dance floors. Visually closer to RH, Aesop, and Peerspace than to Booqable, Wix, or a kids-party site. Survives a YouTuber teardown of "premium vs cheap rental sites."

### Non-goals
- A radical new IA. Section order is tightened, but every existing data source (`getFeaturedCatalogList`, `getOrganizationSettings`, `getContentSettings`, `getServiceAreasGeo`, i18n messages, brand settings) stays wired exactly as it is now.
- Brand-color removal. Operators who set `--primary` to anything they want still win over our defaults. We are setting a better default and a stricter type/spacing/photo system — not removing tenant control.
- Dashboard, login, or marketing-site (root domain) changes. CSS is already scoped to `body:has(.st-header):not(:has(.sidebar-layout))` — that gate stays.
- Vertical-aware page bodies beyond what's listed in §6. Other route changes (PDP, checkout, inventory list) are out of scope; they can pick up tokens via a follow-up.

---

## 2. Design principles (the seven invariants)

These are **non-negotiable**. Each is a constraint the build is allowed to enforce mechanically (linter, code review, design review).

1. **Monochrome base + one restrained accent.** Color comes from photography, never from chrome. Zero saturated brand color in the default theme.
2. **Editorial typography.** One serif display face for headings (Fraunces); one neutral grotesque for everything else (Inter Tight). Body 16–17px / 1.55. Headlines 1.04–1.10. No third typeface.
3. **Photography-forward hero.** One image, one specific headline, one text-link CTA. No carousel, no two-button stack, no overlay gradient. Photography rule: **environments, not occupants** — empty tent at dusk, single bounce house on a lawn, tablescape at candlelight. No people mid-action in any default hero image.
4. **Friction as luxury.** "Inquire" / "Check availability" / "Request a quote" — never "Book Now!", never urgency pills, never countdown timers.
5. **Hairlines, not shadows.** 1px borders in `--st-line` group content. `box-shadow` is forbidden on cards, banners, and CTAs (one exception: focus rings — see §5).
6. **Whitespace doubled.** Section vertical padding ≥ 96px desktop (≥ 64px mobile). Take the spacing that feels enough, then double it.
7. **Interaction density, not visual density.** Sparse visually, dense in micro-states. Every interactive element has six defined states (default/hover/focus/active/disabled/loading) per the Vercel / Linear / Stripe pattern documented at [Mantlr — How Stripe, Linear, and Vercel ship premium UI](https://mantlr.com/blog/stripe-linear-vercel-premium-ui).

---

## 3. Anti-patterns — explicitly forbidden in the default theme

Each of these is a recurring "looks cheap" signature from the 2026 research (see `[carnival roast]` in the deep-research output). The build MUST NOT introduce any of them. A reviewer can grep for the listed CSS or markup signals to enforce.

| # | Anti-pattern | Grep-able signal | Where this came from |
|---|---|---|---|
| 1 | Saturated brand-color gradient CTA banner | `linear-gradient(.*--st-primary.*--st-primary-light` or any `background: linear-gradient` on a CTA section | The carnival theme's closing banner — top reason it read as MailChimp 2016 |
| 2 | Emoji as iconography (🎉 🎈 🏰) | unicode `\u{1F300}-\u{1FAFF}` inside trust badges, feature lists, or section headings | The carnival trust-strip |
| 3 | More than two accent colors competing | More than one `var(--st-accent*)` or `var(--st-primary*)` family in a single viewport | Bootstrap-era pill overload |
| 4 | Status pills (green "Available" / red chips) | `border-radius: var(--st-radius-pill)` on anything containing `Available`/`Unavailable`/`Limited` | Same — replaced by a 6px coloured dot + label |
| 5 | `box-shadow` on cards, banners, or CTAs | `box-shadow:` anywhere except focus rings | The carnival product card |
| 6 | Drop-shadowed glossy buttons with large blur | `box-shadow: 0 \d+px [4-9]\d+px` on `<button>` or `.cta-*` | Soft-UI 2019 holdover |
| 7 | Plus Jakarta + Sora pairing | `'Plus Jakarta Sans'`, `'Sora'` in any new CSS | The carnival type system — the Framer/Webflow template default |
| 8 | Centered hero with two stacked CTAs | `text-align: center` on the hero copy block + two `<button>`/`<Link>` siblings | The carnival hero before this rebuild |
| 9 | Pill-shaped (`border-radius: 9999px`) CTA buttons | `border-radius: var(--st-radius-pill)` on `<button>` | Reads as kids-app / Stripe-dashboard, not editorial |
| 10 | Vague aspirational headlines ("Make memories that last") | Manual review — no grep | Replaces specificity with feel-good |
| 11 | Stock photo of people pointing at a laptop | Manual review — no grep | Universal cheap-tell |
| 12 | More than 2 typefaces | Count `font-family` declarations outside `--st-font*` tokens | Real-estate / event premium standard is 2–3, default is 2 |

**Scrim exemption [as-built]:** Anti-pattern #1 forbids *saturated brand-color* gradients. Neutral **dark legibility washes** (the hero scrim, the category/vibe tile overlays) are explicitly allowed — they're typographic tools serving white-on-photo legibility, the same exemption as `text-shadow` on `.st-vibe-caption`. The grep distinction: allowed gradients only use `rgba(0, 0, 0, …)` stops; any gradient referencing `--st-primary` / `--st-accent` / a saturated hex on a CTA surface is still a violation.

---

## 4. Design tokens

All tokens live in `app/storefront-theme.css`, scoped to `:root:not(:has(.sidebar-layout))` so dashboard / SaaS marketing pages are unaffected. Brand-override path stays intact: `--st-primary` falls through to `var(--primary, <default>)`.

### 4.1 Palette (5 hex + 1 accent)

```css
--st-bg:        #F7F4EE;   /* warm off-white — page background */
--st-bg-alt:    #F2EDE3;   /* one tick warmer — for browse/coverage tints if needed */
--st-card:      #FFFFFF;   /* product card surfaces ONLY */
--st-ink:       #1A1A1A;   /* near-black — headlines, body */
--st-ink-2:     #3D3935;   /* secondary text */
--st-muted:     #5C5651;   /* body muted, lede */
--st-muted-2:   #8A847C;   /* tracked-out eyebrows, captions */
--st-line:      #E4DED3;   /* hairline borders */
--st-line-2:    #CFC7B7;   /* form-field borders (one tone deeper) */

/* The single accent. Default = deep olive; brand override still wins. */
--st-primary:        var(--primary, #3F4A33);   /* deep olive */
--st-primary-hover:  color-mix(in srgb, var(--st-primary) 88%, #000);
--st-primary-soft:   color-mix(in srgb, var(--st-primary) 8%, var(--st-bg));
--st-accent:         var(--accent, var(--st-primary));   /* second accent collapses to primary by default */

/* Status — small dots only, never pills */
--st-success:   #4C6B3A;
--st-warning:   #B3811F;
--st-danger:    #8E3838;
```

**Accent rationale.** Deep olive `#3F4A33` reads sophisticated across all six verticals (works for tents, wedding tabletop, AND inflatables without feeling sterile). It pairs with cream the way RH's bronze pairs with taupe. If a tenant overrides `--primary`, theirs wins — operators with a strong brand identity are first-class.

**Tenant override alternates we explicitly tested in the mockup as drop-ins:** `#B0533A` (desaturated terracotta — warmer, still editorial), `#1F2A3A` (ink navy — most institutional). Either lands cleanly via the override path.

### 4.2 Type system

Both faces are open-source, on Google Fonts, already preconnected in `app/layout.tsx`. Load only the weights we use.

```css
--st-font-display: "Fraunces", "Iowan Old Style", Georgia, serif;
--st-font-body:    "Inter Tight", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

Drop "DM Sans", "Plus Jakarta Sans", "Sora", and "DM Serif Display" from the Google Fonts URL in `app/layout.tsx`. They're the previous-iteration tells; not loading them is a quiet but meaningful win.

**Type scale (desktop):**

| Token | Size | Line height | Letter spacing | Weight | Family | Use |
|---|---|---|---|---|---|---|
| `--st-text-eyebrow` | 11 px | 1.2 | 0.18em | 500 | body | Tracked uppercase kicker |
| `--st-text-12` | 12 px | 1.45 | normal | 500 | body | Footer legal, captions |
| `--st-text-13` | 13 px | 1.5 | normal | 500 | body | Footer links, button text |
| `--st-text-14` | 14 px | 1.55 | normal | 400 | body | Nav links |
| `--st-text-15` | 15 px | 1.6 | normal | 400 | body | Step body, FAQ answer |
| `--st-text-16` | 16 px | 1.6 | normal | 400 | body | Body default |
| `--st-text-17` | 17 px | 1.6 | normal | 400 | body | Hero lede |
| `--st-text-h3` | 22 px | 1.2 | −0.015em | 400 | display | Trust statement, product name, step title |
| `--st-text-h2` | 40 px | 1.10 | −0.022em | 400 | display | Section H2 |
| `--st-text-h2-quote` | 32 px | 1.30 | −0.015em | 400 | display | Pull-quote |
| `--st-text-h1` | 72 px | 1.04 | −0.025em | 400 | display | Hero H1 |
| `--st-text-display` | 56 px | 1.05 | −0.025em | 400 | display | Closing statement |

**Type scale (mobile, ≤ 760 px):**

| Token | Mobile size | Mobile line height |
|---|---|---|
| `--st-text-h1` | 40 px | 1.10 |
| `--st-text-h2` | 28 px | 1.15 |
| `--st-text-h2-quote` | 24 px | 1.30 |
| `--st-text-display` | 36 px | 1.10 |
| Everything else | unchanged | unchanged |

Sources backing these numbers: [Sami Haraketi — Website Dimensions & Typography 2026](https://www.samiharaketi.com/post/website-dimensions-typography-in-2026-a-practical-guide-for-web-designers) (H1 40–52 / H2 28–40 / H3 20–26 / body 16–18); [Luxury Presence — Real estate brand fonts 2026](https://www.luxurypresence.com/blogs/brand-fonts-real-estate-website/) (premium 2–3 typefaces, heavy display); [Learn UI Design — Font size guidelines](https://www.learnui.design/blog/mobile-desktop-website-font-size-guidelines.html) (16px body minimum on all devices).

### 4.3 Spacing scale

Single 4px-rooted scale, six steps. Sections double-up two tokens.

```css
--st-space-1: 4px;
--st-space-2: 8px;
--st-space-3: 12px;
--st-space-4: 16px;
--st-space-5: 24px;
--st-space-6: 32px;
--st-space-7: 48px;
--st-space-8: 64px;
--st-space-9: 96px;
--st-space-10: 128px;

/* Vertical rhythm */
--st-section-pad-y:        96px;   /* default section padding */
--st-section-pad-y-large:  128px;  /* hero, closing */
--st-section-pad-y-mobile: 64px;
```

**Container:** `max-width: 1280px; padding: 0 40px;` on desktop, `padding: 0 20px;` ≤ 760 px.

**Hero grid:** `grid-template-columns: 5fr 7fr; gap: 80px;` (text left ~42%, photo right ~58%). Mobile collapses to single column with `gap: 28px` and the photo on top.

### 4.4 Radii

```css
--st-radius-0:    0;       /* hairline rules */
--st-radius-2:    2px;     /* buttons, inputs */
--st-radius-4:    4px;     /* card containers if needed */
/* No --st-radius-pill is exported. Removing the token prevents accidental pill reintroduction. */
```

### 4.5 Motion

Single easing curve, two durations. No spring, no bounce.

```css
--st-ease:        cubic-bezier(0.16, 0.84, 0.32, 1);
--st-duration-1:  150ms;   /* state transitions */
--st-duration-2:  400ms;   /* image scale, accordion open */
```

### 4.6 Focus ring (the one allowed shadow)

```css
--st-focus-ring: 0 0 0 3px color-mix(in srgb, var(--st-primary) 28%, transparent);
```

Applied on `:focus-visible` for all interactive elements (`button`, `a`, `input`, `select`, summary, `[role="button"]`). Documented intentional ring per the Stripe/Linear pattern — not a Bootstrap default.

---

## 5. Component specifications

Each component below has: **(a)** purpose, **(b)** HTML structure (JSX outline), **(c)** CSS spec, **(d)** content/data wiring, **(e)** state coverage, **(f)** acceptance checks.

### 5.1 Header — `components/public/themes/party-classic/header.tsx`

**(a)** Brand left, four-link nav right, single `Inquire` text-link CTA at the rail. No phone number in the nav by default (drop-down from `theme.headerPhoneVisible` still respected — when true, the phone renders as plain text in the same row, no pill background).

**(b)**
```tsx
<header className="st-header">
  <div className="st-container st-nav">
    <Link href="/" className="st-brand">
      <span className="st-brand-mark">{businessName}</span>
      {serviceAreaLabel && (
        <span className="st-brand-tagline">{verticalLabel} · {serviceAreaLabel}</span>
      )}
    </Link>
    <nav className="st-nav-links">
      {visibleNavLinks.map(link => <Link key={link.key} href={link.href}>{link.label}</Link>)}
      <LanguageSwitcher … />
      {showPhone && <span className="st-nav-phone">{phoneDisplay}</span>}
      <Link href="/contact" className="st-nav-cta">Inquire</Link>
    </nav>
    <div className="st-nav-mobile">…</div>
  </div>
</header>
```

**(c)**
- `.st-header` — `padding: 22px 0; border-bottom: 1px solid var(--st-line); background: var(--st-bg);` (NOT sticky on this rebuild — sticky read as Webflow-y in QA; drop it.)
- `.st-brand-mark` — `font-family: var(--st-font-display); font-weight: 500; font-size: 26px; letter-spacing: -0.025em;`
- `.st-brand-tagline` — eyebrow token (11px / 0.18em uppercase / `--st-muted-2`).
- `.st-nav-links` — `display: flex; gap: 32px; align-items: center;`; links at `--st-text-14`, color `--st-ink`, no underline.
- `.st-nav-cta` — `font-size: 13.5px; letter-spacing: 0.06em; text-transform: uppercase; border-bottom: 1px solid var(--st-ink); padding-bottom: 2px;` (text-link, not button)
- Mobile (≤ 760 px): nav links collapse into existing `MobileMenuToggle`. Brand mark stays at 22px, tagline drops to single-line ellipsis.

**(d)** All existing data sources kept: `getBrandSettings`, `getOrganizationSettings`, `getOrgContext`, `getContentSettings`, `getThemeSettings`, `getTranslator`. New: read `settings.primaryVertical` (already on `organizations`) and derive `verticalLabel` via the existing `lib/verticals/` registry for the tagline.

**(e)** Hover on nav link → color shifts to `var(--st-primary)` over 150 ms. Hover on `Inquire` → border + text color shift to `var(--st-primary)`. Focus visible → ring per §4.6.

**(f)** Acceptance:
- Screenshots at 1440 / 1024 / 760 / 390 match mockup composition (no centered logo, no pills, no orange anywhere by default).
- Phone hidden by default (most demo content rows are placeholders); shown only when `theme.headerPhoneVisible && phone !== "(555) 000-0000"`.
- Operator with a logo (`brand.logoUrl`) replaces the wordmark + tagline cleanly.

### 5.2 Hero — `components/public/themes/party-classic/hero.tsx` **[as-built: full-bleed]**

> The original proposal here specified an asymmetric 5fr/7fr split (text left,
> photo right). User feedback after PR #337 shipped: the split read low-impact
> on desktop and the availability bar overflowed at mobile widths. PR #343
> replaced it with the full-bleed composition documented below — the
> Peerspace / RH / Found Rentals pattern from §10.

**(a)** Full-bleed editorial hero. The photograph fills the viewport width; headline + lede overlay it bottom-left in white over a neutral dark legibility scrim. The availability bar sits **below** the hero on cream, full-width within the container. No carousel, no stats row, no floating card.

**(b)**
```tsx
<section className="st-hero">
  <div className="st-hero-photo">
    <img src={heroImage} fetchPriority="high" … />
    <div className="st-hero-scrim" aria-hidden="true" />
  </div>
  <div className="st-container st-hero-content">
    {showLiveChip && <span className="st-hero-live-chip">…</span>}
    {showRating && <span className="st-hero-rating-chip">…</span>}
    <h1 className="st-h1">{headlineLead} <em>{headlineItalic}</em></h1>
    <p className="st-lede">{lede}</p>
  </div>
</section>
<section className="st-container st-hero-actions">
  <form action="/inventory" className="st-avail" role="search">…</form>
  <div className="st-hero-cta-row">…text links…</div>
</section>
```

**(c)**
- `.st-hero` — `height: clamp(560px, 78vh, 820px)` desktop; mobile becomes a 4:5 aspect block with a 460px floor.
- `.st-hero-scrim` — two layered neutral gradients: a bottom-up wash (transparent to 22%, 0.45 at 55%, 0.82 at the bottom) plus a left-side wash (0.35 → 0 by 72%) that deepens contrast specifically where the headline anchors. Mobile uses a single stronger band (0.55 at 60%, 0.88 at bottom). **This is a typographic legibility tool, not brand chrome — see the scrim exemption note in §3.**
- `.st-h1` — white, fluid `clamp(40px, 6.4vw, 72px)`, layered text-shadow (tight 0–2px contact shadow + wide soft halo). **Specificity warning:** the body-scoped `h1 { color: var(--st-ink) }` rule outranks `.st-hero .st-h1`; the white override is anchored through `.st-shell .st-hero .st-h1` (0,3,2) — don't simplify the selector (PR #346 was this exact bug).
- `.st-lede` — white at 100% opacity, fluid 15–17px, matching shadow.
- Sub-360px breakpoint: H1 32px / 12ch, lede 14px.

**(c.1) Availability bar — `.st-avail` (below the hero)**
- Desktop — `grid-template-columns: 1fr 1fr auto; border: 1px solid var(--st-line-strong); border-radius: 2px; max-width: 560px;` Submit is the black uppercase **"Check availability"** button; hover `var(--st-primary)`.
- **Mobile stacks**: date row → ZIP row → full-width black submit with `min-height: 52px`. Right-cell borders collapse to bottom borders.
- Inputs are **16px** (anything smaller triggers iOS Safari focus-zoom), `autoComplete="postal-code"` + `maxLength` + `pattern` on ZIP, `autoComplete="off"` on date, `-webkit-appearance: none` with normalized datetime-edit colors.
- Form action stays `/inventory`, posting `date` and `zip` query params.

**(d)** Wiring:
- `headlineLead` + `headlineItalic` come from the vertical's `storefrontDefaults` (lib/verticals/*.ts) unless the operator set `settings.heroHeadline` (which renders whole, non-italic).
- `lede` comes from `settings.websiteMessage || withArea(defaults.lede, serviceAreaLabel)`. **`getOrganizationSettings()` returns empty string — not a platform fallback — when `hero_message` is unset**, so the vertical default actually flows through (PR #350 fixed the clobbering fallback).
- `heroImage` comes from `settings.heroImageUrl || defaults.heroImagePath` (§6).
- `RatingChip` renders when `testimonialCount >= 3 && avgRating >= 4`; the live availability chip renders when `theme.availabilityChipVisible && readyCount > 0`. Both float in the overlay with a frosted-glass treatment (`rgba(0,0,0,0.42)` + backdrop-blur + white hairline border).

**(e)** Same six-state coverage as §4.6 on every input + button.

**(f)** Acceptance (all verified on production via Playwright):
- Headline is vertical-specific and place-specific; white and legible over every curated hero photo at desktop + mobile.
- No `.st-social-row`, `.st-hero-stats`, `.st-price-pill`, `.st-delivery-pill` in the rendered DOM.
- No horizontal scroll at 320 / 375 / 390 / 430 px.
- Availability bar stacks at mobile with ≥48px tap targets.

### 5.3 Trust band — `components/public/themes/party-classic/trust-strip.tsx`

**(a)** Three pillars between hairline rules. **No icons.** No emoji. Each pillar = small uppercase kicker + 19px serif statement.

**(b)**
```tsx
<section className="st-trust">
  <div className="st-container st-trust-grid">
    {badges.slice(0, 3).map((b, i) => (
      <div key={i} className="st-trust-item">
        <span className="st-eyebrow">{b.kicker}</span>     {/* short label: "Insured", "On time", "Five stars" */}
        <p className="st-trust-statement">{b.statement}</p>  {/* long-form sentence in display serif */}
      </div>
    ))}
  </div>
</section>
```

**(c)**
- `.st-trust` — `border-top: 1px solid var(--st-line); border-bottom: 1px solid var(--st-line); padding: 40px 0;`
- `.st-trust-grid` — `display: grid; grid-template-columns: repeat(3, 1fr); gap: 56px;`. Mobile: stacks at 1 col with `gap: 28px`.
- `.st-trust-statement` — `--st-text-h3` (22px display).

**(d)** Re-shape `contentSettings.trustBadges` from `{title, description}` to support an optional `{kicker, statement}` pair. Migration: existing `title` becomes `kicker` (truncate to 16 chars in i18n defaults), existing `description` becomes `statement`. The i18n defaults (`m.storefront.trust.defaults`) get re-written per §6.

**(f)** Acceptance:
- Inspecting the rendered band shows zero `<svg>` and zero emoji code points.
- The three statements render in Fraunces, not Inter Tight.

### 5.4 Browse by occasion — NEW `components/public/themes/party-classic/browse-tiles.tsx`

Replaces the current `PartyClassicCategoryTiles`. Three full-bleed editorial tiles, each linking to `/inventory?category=…`. Image with overlay caption that's small uppercase + display title.

**(b)**
```tsx
<section className="st-section">
  <div className="st-container">
    <SectionHead kicker="Browse by occasion" title="Made for the day, planned for the year." link={{label:'All categories →', href:'/inventory'}}/>
    <div className="st-browse-grid">
      {tiles.map(t => (
        <Link key={t.slug} href={t.href} className="st-vibe">
          <img src={t.imageUrl} alt={t.label} />
          <span className="st-vibe-label">
            <small>{t.kicker}</small>
            {t.label}
          </span>
        </Link>
      ))}
    </div>
  </div>
</section>
```

**(c)**
- `.st-browse-grid` — `display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px;` Mobile: 1 col, `gap: 16px`.
- `.st-vibe` — `position: relative; aspect-ratio: 4/5; overflow: hidden; display: block; background: var(--st-line);` Image: `transition: transform 400ms var(--st-ease);` Hover: `transform: scale(1.03);`
- `.st-vibe-label` — bottom-left, white, display serif 22px, with a tracked-uppercase eyebrow above. Uses `text-shadow: 0 1px 16px rgba(0,0,0,0.35)` for legibility — the **only** shadow allowed in the theme (it's a typographic legibility tool, not chrome).
- No gradient overlay div is added (text-shadow alone handles legibility on tested images).

**(d)** Data: per-vertical tile presets (§6) merged with operator overrides via `contentSettings.browseTiles` if set. Each tile = `{kicker, label, imageUrl, href}`.

**(f)** Acceptance: tiles are linked to filtered inventory views, not standalone pages.

### 5.5 Featured rentals (in-page block in `app/page.tsx`)

3-up editorial card grid. Not 4 — the 4-up grid is the SaaS-template tell every Booqable site uses. Three cards give each photo room to breathe and breaks the SaaS pattern.

**(b)**
```tsx
<section className="st-section">
  <div className="st-container">
    <SectionHead kicker="A few favorites" title="Most-booked this season." link={{label:'View the catalog →', href:'/inventory'}}/>
    <div className="st-rentals-grid">
      {featured.slice(0, 3).map(p => <ProductCard {…p}/>)}
    </div>
  </div>
</section>
```

**(c) — `<ProductCard>` (`components/public/product-card.tsx`)**

```tsx
<article className="st-rental">
  <Link href={detailHref} className="st-rental-photo">
    <Image src={imageUrl ?? fallback} alt={name} fill … />
  </Link>
  <div className="st-rental-body">
    <span className="st-eyebrow st-rental-cat">{category}</span>
    <Link href={detailHref} className="st-rental-name">{name}</Link>
    <div className="st-rental-meta">
      <span className="st-rental-price">{amount}<small>{period}</small></span>
      <span className="st-status" data-state={statusToken}>{statusLabel}</span>
    </div>
    <Link href={detailHref} className="st-text-link">Details & availability →</Link>
  </div>
</article>
```

- `.st-rental` — no border, no shadow, transparent background. Stacks vertically.
- `.st-rental-photo` — `aspect-ratio: 4/5; overflow: hidden; background: var(--st-line); margin-bottom: 18px;`. Photo at `width: 100%; height: 100%; object-fit: cover;`. Hover: `transform: scale(1.02)` on the inner image over 400 ms.
- `.st-rental-cat` — eyebrow token.
- `.st-rental-name` — `--st-text-h3` (22px display), color `--st-ink`. Hover: color shifts to `--st-primary`.
- `.st-rental-meta` — `display: flex; align-items: baseline; justify-content: space-between; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--st-line);`
- `.st-rental-price` — display 18px, with `small` (body 13px `--st-muted-2`) for the period.
- `.st-status` — small dot + label. Markup: `<span class="st-status" data-state="available">Available</span>`. CSS uses `data-state` to pick the dot color. **No `border-radius: pill`, no chip background.** Just a 6px dot via `::before` + 12.5px label in `--st-muted`.

**(d)** Existing props kept (`name`, `slug`, `price`, `category`, `description`, `status`, `imageUrl`, `date`, `zip`). The `description` prop is no longer rendered in this card (the editorial pattern shows it on the PDP, not the index). We keep the prop for backward compatibility with `/inventory/[slug]` previews.

**(f)** Acceptance:
- Inspecting a card shows zero box-shadow, zero pill-radius, zero green chip background.
- 3 cards on desktop, 2 cards on mid-tablet (≤ 1024), 1 card on mobile (≤ 760).

### 5.6 How it works — `components/public/how-it-works.tsx`

Three steps, serif italic numerals in the accent color.

**(b)**
```tsx
<section className="st-section st-how">
  <div className="st-container">
    <SectionHead kicker="How it works" title="Three steps. No guesswork." />
    <div className="st-how-grid">
      {steps.map((step, i) => (
        <div key={step.title} className="st-step">
          <div className="st-step-num">{String(i+1).padStart(2,'0')}</div>
          <div className="st-step-title">{step.title}</div>
          <p className="st-step-body">{step.description}</p>
        </div>
      ))}
    </div>
  </div>
</section>
```

**(c)** `.st-step-num` — display 38px italic, color `--st-primary`, line-height 1. `.st-step-title` — display 22px. `.st-step-body` — 15px / 1.6 / `--st-muted`.

### 5.7 Pull-quote review — `components/public/themes/party-classic/reviews-cards.tsx` → renamed `reviews-quote.tsx`

**Single** centered pull-quote, not three chip cards.

**(b)**
```tsx
<section className="st-section st-quote">
  <div className="st-container st-quote-inner">
    <div className="st-quote-stars">★ ★ ★ ★ ★</div>
    <p className="st-quote-text">
      &ldquo;{leadPhrase} <em>{italicPhrase}</em>{tailPhrase}&rdquo;
    </p>
    <div className="st-quote-attr">{author} · {location} · {month} {year}</div>
  </div>
</section>
```

**(c)** `.st-quote-text` — `--st-text-h2-quote` (32 desktop / 24 mobile). The `<em>` is true italic. Max-width 760 px, centered.

**(d)** Pulls the highest-rated testimonial from `contentSettings.testimonials`. Auto-splits into lead/italic/tail via a simple heuristic — match the **shortest fragment** between commas/periods that includes a positive adjective. If the heuristic fails, render the quote without italics. Fallback when no testimonials: section omitted entirely.

**(f)** Acceptance: only one review on the homepage. "Read more reviews →" text-link below the attribution links to a future `/reviews` page (out of scope for v1 — link to `/contact` for now).

### 5.8 Coverage — `components/public/themes/party-classic/service-area-zip-map.tsx`

Left: kicker + H2 + lede + ZIP list as plain text (NOT pills). Right: quiet warm-gradient map block with olive dots.

**(c) [as-built]**
- ZIP list — auto-fill grid (`minmax(140px, 1fr)`), each entry `<strong>{zip}</strong>` (display 17px) above `{city}` (13.5px `--st-muted`). No backgrounds, no borders.
- Map — the **real Leaflet `ServiceAreaMap`** (lazy-loaded client component from `components/maps/service-area-map.tsx`), wrapped in `.st-coverage-map-frame` (4:3 aspect, hairline border, editorial bg behind tile loads). The original proposal's stylized warm-gradient block shipped briefly and was replaced in PR #350 — operators geocode real service areas and expect to see them on a real map.

### 5.9 FAQ — `components/public/faq-section.tsx`

Single column, hairline-separated. Display-serif questions; toggle is a minus/plus glyph in display serif (no chevron SVG).

**(b)** Same accordion behavior. Default open index = 0.

**(c)** `.st-faq-item` — `border-top: 1px solid var(--st-line); padding: 22px 0;` last item also gets `border-bottom`. Question: `--st-text-h3` (22px display). Answer: 15px / 1.6 / `--st-muted`, `max-width: 56ch`, `margin-top: 14px`. Toggle: display serif 22px in `--st-muted-2`.

Layout: 5fr / 7fr two-column grid — left column is `kicker + H2 + lede`; right column is the accordion list. Stacks on mobile.

### 5.10 Closing CTA — NEW `components/public/themes/party-classic/closing.tsx`

**No orange gradient banner. No banner at all.** A single centered display-serif statement on the cream background, then one outlined ghost-button.

**(b)**
```tsx
<section className="st-section st-closing">
  <div className="st-container">
    <p className="st-display">Ready when you are. <em>Check a date.</em></p>
    <Link href="/inventory" className="st-ghost-btn">Check availability</Link>
  </div>
</section>
```

**(c)** `.st-display` — `--st-text-display` (56 desktop / 36 mobile). `.st-ghost-btn` — `display: inline-flex; padding: 12px 22px; font-size: 13.5px; letter-spacing: 0.04em; color: var(--st-ink); background: transparent; border: 1px solid var(--st-ink); border-radius: 2px;`. Hover: invert (ink background, cream text).

### 5.11 Footer — `components/public/public-footer.tsx`

Hairline divider above, four-column layout: brand wordmark + business description; Catalog; Company; Contact. "Powered by Korent" pinned bottom-right.

CSS spec lifted from the mockup file as-is. No re-architecture required; this file becomes a styling pass only.

### 5.12 Shared `<SectionHead>` (NEW)

```tsx
function SectionHead({ kicker, title, link, center=false }: {
  kicker: string;
  title: string;
  link?: { label: string; href: string };
  center?: boolean;
}) { … }
```

Lives at `components/public/themes/party-classic/section-head.tsx`. CSS: flex with `justify-content: space-between; align-items: flex-end; margin-bottom: 44px;`. When `center={true}`, swaps to centered single-column layout (no link).

---

## 6. Per-vertical defaults

Resolved by `settings.primaryVertical` (already on `organizations.settings.primary_vertical`, served by `lib/verticals/`). When operator hasn't overridden the headline/lede/hero image, these tables drive the default.

| Vertical | Default hero image URL | Default H1 (lead + italic accent) | Default lede | Vertical label in tagline |
|---|---|---|---|---|
| `inflatables` | Bounce house on a manicured lawn at golden hour (no kids) — see image-pool list below | "Bounce houses and water slides, *delivered with care*." | "Backyard birthdays, school events, and neighborhood celebrations across {area}. Every unit commercially insured, inspected, and set up before guests arrive." | "Party rentals" |
| `tents` | Pole tent at dusk with string lights, no occupants | "Tents, tabletop, and dance floors *for the moments that matter*." | "Weddings, corporate dinners, and milestone celebrations across {area}. Tents sized and styled to your guest count." | "Event rentals" |
| `tables-and-chairs` | Empty tablescape under candlelight | "Chairs, tables, and tabletop *styled for the day*." | "Bring your vision to the table. Curated chairs, table styles, and linens across {area}." | "Event rentals" |
| `dance-floors` | Empty dance floor under string lights | "Dance floors *built for the night*." | "Parquet, black-and-white, and LED dance floors with crew setup across {area}." | "Event rentals" |
| `photo-booths` | Editorial photo booth in a styled event setting, booth empty | "Photo booths *with the editorial feel*." | "Open-air and enclosed booths with custom print designs across {area}. Crew-attended every event." | "Event rentals" |
| `concessions` | Single popcorn cart, clean ground, no operator in frame | "Popcorn, cotton candy, and shaved ice *for the crowd*." | "Cart-rental favorites delivered, stocked, and attended across {area}." | "Party rentals" |

**Image pool.** A small curated set lives at `public/storefront-defaults/hero/{vertical}.jpg` (we package licensed Unsplash photos at build time so production doesn't depend on Unsplash uptime). Selection is by `vertical` only — no per-tenant randomization (that's a defect surface).

**Vibe-tile defaults.** Each vertical also defines three default browse tiles (kicker + label + tile image + filter href). Spec for those is encoded in `lib/verticals/{vertical}.ts` (extend existing files, don't add new ones).

**Trust-strip defaults.** Each vertical has three default `{kicker, statement}` pairs in i18n. Inflatables example:
- `{kicker: "Insured", statement: "Commercial liability insurance on every unit, every event."}`
- `{kicker: "On time", statement: "Crews arrive within a one-hour delivery window, set up before guests."}`
- `{kicker: "Trusted", statement: "More than 500 events delivered across {area}."}`

(The third copies in tenant `serviceAreaLabel` via i18n interpolation; falls back to "the metro area" when empty.)

---

## 7. Implementation plan

Three sequential PRs, each independently shippable and revertable. Each runs CI and builds the Vercel preview before merge. No PR touches more than ~12 files. No PR includes the production-DB demo color override (that's a separate manual step gated on §8).

### PR 1 — Tokens + global page restyle ("the bones")
**Scope:** `app/storefront-theme.css` (full rewrite of tokens + non-component classes), `app/layout.tsx` (Google Fonts URL: drop DM Sans / DM Serif Display / Plus Jakarta / Sora; add Fraunces and Inter Tight with the weights we actually use), `app/page.tsx` (section reorder + new in-page Popular Rentals block + section spacing), `components/public/themes/party-classic/section-head.tsx` (new shared subcomponent), `components/public/themes/party-classic/closing.tsx` (new).
**Removed from page render:** PressRow, CategoryTiles (replaced by BrowseTiles in PR 2), AboutSection (folds into footer description), the old reviews-cards multi-card section, and the orange gradient CTA banner. Files stay on disk for now (no exports break).
**Smoke:** Vercel preview at a tenant subdomain renders the new palette, type, header, hero copy column (without the photo-side spec), and footer with no errors. Lighthouse a11y ≥ 90 on desktop and mobile.

### PR 2 — Hero photo + booking widget + browse tiles + product card
**Scope:** `components/public/themes/party-classic/hero.tsx` (full rewrite per §5.2), `components/public/themes/party-classic/browse-tiles.tsx` (new, per §5.4), `components/public/themes/party-classic/trust-strip.tsx` (per §5.3 — drop icons), `components/public/product-card.tsx` (rebuild per §5.5), `lib/verticals/<each-vertical>.ts` (add `defaults.hero`, `defaults.headlineLead`, `defaults.headlineItalic`, `defaults.lede`, `defaults.vibeTiles`, `defaults.trustBadges` exports).
**New asset:** `public/storefront-defaults/hero/{vertical}.jpg` checked in (6 images, ≤ 200 KB each after `cwebp -q 78`).
**Smoke:** Tenant subdomain hero matches mockup composition. Inflatables tenant shows the bounce-house hero photo (not the tablescape stand-in). Product card is the 3-up editorial layout, no shadows, no pills.

### PR 3 — How it works + pull quote + coverage + FAQ + closing + accessibility pass
**Scope:** `components/public/how-it-works.tsx`, `components/public/themes/party-classic/reviews-quote.tsx` (rename of reviews-cards), `components/public/themes/party-classic/service-area-zip-map.tsx` (style pass only), `components/public/faq-section.tsx`, `app/page.tsx` (wire Closing component), plus full `:focus-visible` ring application across every interactive element.
**A11y deliverable:** axe-core CLI clean on the rendered page (zero serious/critical issues). Skip-to-content link in the header. Color contrast spot-check on every text/background pair against `--st-bg` and `--st-card`.

### Out-of-scope follow-ups (not in this rebuild)
- PDP (`/inventory/[slug]`) restyle to match the new token system.
- Inventory index (`/inventory`) restyle.
- Checkout / order-confirmation pages.
- Per-vertical `app/[vertical]/page.tsx` landing pages.
- Demo-org brand-color override flip (`#2563eb` → unset, so it picks up our olive default) — needs a tenant-facing Settings UI change so the operator can choose, not a silent migration.

---

## 8. Acceptance criteria (whole rebuild)

A YouTuber teardown of `demo.korent.app` next to `peerspace.com`, `foundrentalco.com`, `bbjlatavola.com` should not produce a "this looks cheap" call-out. Concretely:

- [ ] No saturated orange/red/yellow in chrome — only in operator-uploaded photos.
- [ ] No emoji code points (`\u{1F300}–\u{1FAFF}`) in any rendered storefront page.
- [ ] No `box-shadow` declarations on `.st-trust*`, `.st-cta*`, `.st-rental*`, `.st-vibe*`, `.st-closing*`, `.st-av-*`, `.st-hero-*`. (One allowed exception: `--st-focus-ring`.)
- [ ] No `border-radius: 9999px` on `<button>` (rating chip is exempted by class allowlist).
- [ ] Type system uses exactly two font families: `Fraunces` + `Inter Tight`. (`DM Sans`, `Plus Jakarta Sans`, `Sora`, `DM Serif Display` not loaded.)
- [ ] Hero is asymmetric (text 42% / photo 58%); no carousel; one CTA.
- [ ] Trust band has no icons or images.
- [ ] Featured-rental grid is 3-up (desktop), not 4.
- [ ] Closing section is a single underlined ghost button on cream — no gradient banner.
- [ ] Lighthouse: performance ≥ 90 desktop, accessibility ≥ 95 all viewports, best-practices ≥ 95, SEO ≥ 95.
- [ ] axe-core clean (zero serious/critical) on all viewports.
- [ ] Each vertical's tenant subdomain renders a vertical-appropriate default hero photo and headline.

---

## 9. Risks & mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Operators with existing custom `--primary` look broken on the new background. | High | The brand-override path stays. We only change defaults. Test demo (`#2563eb`) and one warm tenant override on the preview before each PR merges. |
| Per-vertical hero images are too narrow a set; tenants with unusual photography don't match. | Medium | Operators can already upload `heroImageUrl` via Settings; our defaults only fill the empty case. Document this clearly in the v1 release note. |
| Fraunces optical sizing causes FOIT on slow connections. | Low | Continue `font-display: swap` (already on Google Fonts); preload the H1 weight (400) only. |
| The single pull-quote review replaces a 3-card section operators valued. | Low–medium | Visibility flag stays; operators can hide via Settings → Content → Testimonials. Reviews page (out of v1) becomes the deep version. |
| Demo org renders with a stale `brand.primary = #2563eb`, masking the olive default for an outside reviewer. | Low–medium | Document a manual Supabase override step in PR 3 release notes — but do not auto-clear, because we may legitimately want demo to model a tenant-customized brand. |

---

## 10. References

Foundational research that grounds this spec:

- [Mantlr — How Stripe, Linear, and Vercel ship premium UI](https://mantlr.com/blog/stripe-linear-vercel-premium-ui) — six-state interaction model, focus-ring discipline.
- [Pixeldarts — Four design principles behind Stripe, Linear, and Vercel](https://www.pixeldarts.com/en/post/four-design-principles-behind-stripe-linear-and-vercel) — restraint + whitespace + contrast.
- [Vercel Web Interface Guidelines](https://vercel.com/design/guidelines) — child radius ≤ parent radius, hover state contrast rules.
- [Luxury Presence — Brand fonts & typography in real estate, 2026](https://www.luxurypresence.com/blogs/brand-fonts-real-estate-website/) — premium 2–3 typeface standard, heavy display headlines.
- [Sami Haraketi — Website Dimensions & Typography 2026](https://www.samiharaketi.com/post/website-dimensions-typography-in-2026-a-practical-guide-for-web-designers) — H1 40–52, H2 28–40, H3 20–26, body 16–18 baseline.
- [Goodshuffle — 17 Best Event Rental Websites](https://pro.goodshuffle.com/blog/best-event-rental-websites/) — premium event rental references (Party Rental Ltd, Found, Wild Ones, Render).
- [Hookagency — Premium website color schemes](https://hookagency.com/blog/website-color-schemes/) — warm off-white over pure white.
- [925studios — AI Slop Web Design Guide](https://www.925studios.co/blog/ai-slop-web-design-guide) — modern anti-pattern catalog.
- [Digital Information World — Emoji misfires hurt brands, Oct 2025](https://www.digitalinformationworld.com/2025/10/emoji-misfires-how-misunderstood-icons.html) — 22% of consumers unfollow over emoji misuse.

Visual exemplars cited for direction:
- [Peerspace](https://www.peerspace.com/) — flat horizontal search bar pattern; "where extraordinary begins" voice.
- [Found Rental Co.](https://foundrentalco.com/) — all-caps editorial display, inquiry-led, no transactional chrome.
- [BBJ La Tavola](https://bbjlatavola.com/) — collection-name italic accents; warm cream + bronze metals.
- [Aesop](https://aesop.com) — text-forward heroes, generous whitespace, literary microcopy.
- [RH](https://rh.com) — thin refined serif logo, all-caps tracked nav, taupe/ivory base, institutional voice.

---

## 11. As-built revision log **[as-built]**

Everything below shipped after the original spec was approved. Each row links the change to its PR so future readers can trace the reasoning.

| PR | Change | Spec impact |
|---|---|---|
| #334 | PR 1 — tokens, page frame, header, closing | Shipped as specced |
| #337 | PR 2 — hero, trust band, product card, browse tiles, vertical defaults | Shipped as specced (asymmetric hero, later revised) |
| #339 | PR 3 — how-it-works, pull-quote, FAQ, coverage, a11y | Shipped as specced (stylized map, later revised) |
| #343 | Hero → **full-bleed** with overlay + dark scrim; availability bar moved below hero; mobile stacking | §5.2 rewritten; scrim exemption added to §3 |
| #344 | Stronger scrim + layered text-shadows | §5.2 (c) |
| #346 | Hero headline color specificity fix (`.st-shell .st-hero .st-h1`) | §5.2 (c) warning note |
| #347 | Mobile polish: 16px inputs (iOS zoom), 48px+ tap targets, `postal-code` autocomplete, tap-highlight removal, hover gating via `@media (hover: hover)`, sub-360px breakpoint | §5.2 (c.1) |
| #350 | Restored **real Leaflet map** (§5.8), **About section** (operator opt-in), **press row** (operator logos), **live availability chip** in hero overlay; fixed `websiteMessage` fallback clobbering per-vertical ledes | §5.2 (d), §5.8, §12 |
| #352 | Inventory `.badge.info` wrap fix; first cross-page-anchor attempt | superseded by #356/#359 |
| #354 / #356 | Cross-page anchor menu items render as plain `<a>` (next/link intercepts clicks before React onClick can preventDefault) | §12 |
| #359 | `HashScrollHandler` — explicit scroll-to-hash on hydration retry loop (Leaflet's late mount aborts the browser's native fragment scroll) | §12 |
| #362 | Six curated per-vertical hero photos replace the Unsplash placeholders (operator-supplied, mozJPEG q82, 152–267 KB) | §6 image pool — now real |
| (this PR) | `/inventory` editorial rebuild; category tiles restored above vibe tiles; "Pricing" dropped from default nav | §12, §13 |

## 12. Section flow — as shipped

The homepage section order as it exists on production (operator-visibility gates in parentheses):

1. Header — wordmark + tagline, 4 nav links, Inquire text-link. Default nav: Catalog / How It Works / Service Area / Order Status / Contact. **"Pricing" was dropped from defaults** — it aliased `/inventory` and read as a broken promise of a price sheet. Operators with stored nav links keep theirs (the merge preserves non-default keys).
2. Full-bleed hero + scrim + overlay chips (live availability · rating)
3. Availability bar + text-link CTA row
4. Trust band (`vis.trust_bar`)
5. Press row (renders only when `theme.pressLogos` exist and `theme.pressRowVisible`)
6. **Category tiles** — operator-curated catalog categories (`vis.category_grid`; renders only when active categories with products exist). Restored after the original rebuild dropped them — operators who curated categories expect them on the homepage.
7. **Browse-by-occasion vibe tiles** — vertical defaults (`vis.category_grid`)
8. Featured rentals — 3-up editorial grid
9. How it works (`vis.how_it_works`)
10. Pull-quote review (`vis.testimonials`)
11. Coverage — ZIP list + real Leaflet map (`vis.service_area_map`)
12. About (`vis.about_section`, default off)
13. FAQ (`vis.faq_section`)
14. Closing CTA — serif statement + ghost button
15. Footer

Cross-page anchor handling: fragment links to a *different* page render as plain `<a>` (full document load → native fragment scroll), and `HashScrollHandler` in `StorefrontShell` retries `scrollIntoView` on a 200ms loop for up to ~1.6s to survive hydration-time layout shifts (Leaflet).

## 13. Catalog index (`/inventory`) — editorial spec **[as-built]**

The catalog index shares the homepage design language:

- **Page head** — `.st-eyebrow` kicker + Fraunces H1 (clamped 32–40px) + lede.
- **Filter bar** (`.st-filter-bar`) — the hero availability-bar pattern extended to four cells: Event Date / Delivery ZIP / Category select / black uppercase submit. Same hairline border, same mobile stacking with full-width 52px submit, same 16px inputs.
- **Context chips** (`.st-context-chip`) — active filters as quiet hairline chips, 2px radius (not pills).
- **Notes** (`.st-note`) — "We deliver to…", "Pick a date…", and ZIP warnings render as left-accent-border notes (2px `--st-primary` / `--st-warning`), replacing the legacy peach `.badge.info` pills.
- **Results head** — shared `SectionHead` with the count as the display title.
- **Search + sort** (`.st-catalog-search` / `.st-catalog-sort`) — hairline-bordered, 2px radius, 16px search input. Client-side filtering unchanged.
- **Grid** — `.st-products-grid` (3-up desktop / 2-up tablet / 1-up mobile), the same editorial ProductCard as the homepage.
- **Empty state** (`.st-empty-state`) — centered serif statement between hairline rules.

Category tiles on `/inventory` (the `?category=` filter source) come from operator categories; the editorial `.st-cat-tile` treatment (square corners, serif caption, neutral dark wash, tracked-uppercase count label) matches `.st-vibe`.

## 14. Open follow-ups

- PDP (`/inventory/[slug]`), checkout, order-status, contact pages still carry legacy styling — same treatment as §13 when prioritized.
- A `/pricing` content page (categories × price ranges + minimums) if operators ask for the nav link back.
- Dashboard Settings UI for the trust-band kicker/statement split (currently folds the legacy title/description shape).
- Hero photography guide for operators (what makes an upload work against the overlay).
