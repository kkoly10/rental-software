-- Add an optional theme emoji column to categories so the party-classic
-- storefront theme can render a "🎀 Princess" / "🦖 Dinosaur" style chip
-- rail above the category tiles. Nullable, no default, no backfill — the
-- storefront treats null as "no emoji" and the category name renders alone.
--
-- Backwards-compatible: every existing query already selects only the
-- columns it needs, so existing reads are unaffected.

alter table public.categories
  add column if not exists theme_emoji text;

-- Short single-line label only; reject anything longer than 8 chars or
-- containing newlines so operators can't paste an entire paragraph here.
alter table public.categories
  drop constraint if exists categories_theme_emoji_length;

alter table public.categories
  add constraint categories_theme_emoji_length
  check (
    theme_emoji is null
    or (char_length(theme_emoji) between 1 and 8 and theme_emoji !~ '[\n\r]')
  );
