-- Phase 3 (listing quality score) — multi-photo listing upload.
--
-- Until now a listing carried a single `photo_url`. The quality score
-- weights photos as the #1 conversion lever and scales with the real
-- photo count, so the product needs to store more than one. This table
-- holds the ordered gallery (up to 6, enforced in the action); the
-- primary photo is still mirrored onto market_listings.photo_url for
-- back-compat with cards, ranking, and existing reads.
--
-- These are INTENTIONAL public media (the storefront's face), same as
-- photo_url / proof videos — files live in the public `market-media`
-- bucket. Rows are service-role writes only (the create action uploads
-- with the admin client); anon/authenticated may READ photos that hang
-- off a published listing.

create table if not exists market_listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references market_listings (id) on delete cascade,
  organization_id uuid not null references organizations (id) on delete cascade,
  url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists market_listing_photos_listing_idx
  on market_listing_photos (listing_id, position);

alter table market_listing_photos enable row level security;

-- Public read for photos of published listings only (mirrors how the
-- listing itself is anon-readable). No client write policies: the
-- create action inserts with the service-role admin client.
drop policy if exists market_listing_photos_public_read on market_listing_photos;
create policy market_listing_photos_public_read
  on market_listing_photos
  for select
  using (
    exists (
      select 1
      from market_listings l
      where l.id = market_listing_photos.listing_id
        and l.status = 'published'
    )
  );

revoke insert, update, delete on market_listing_photos from anon, authenticated;
