-- Marketplace trust v2: Turo-style DIY identity capture, phone
-- verification, instant booking, proof-of-function videos.
--
-- Decision record (founder, 2026-06-11):
--  * No third-party ID verification service. Renters in full_id
--    categories upload an ID photo + live selfie; files live in a
--    PRIVATE bucket, viewable only by platform admins via signed URLs
--    when a dispute arises. The capture is the deterrent.
--  * Signup requires email + phone verification only (SMS OTP).
--  * Instant booking: category must allow it AND the seller opts in
--    per listing; the renter goes hold → Stripe Checkout directly.
--  * Proof of function: powered/electric categories require a seller
--    video of the item working before the listing can publish.

-- Private bucket — NEVER public; access via admin signed URLs only.
insert into storage.buckets (id, name, public)
values ('market-identity', 'market-identity', false)
on conflict (id) do nothing;

create table if not exists public.market_renter_verifications (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  phone text,
  phone_verified_at timestamptz,
  id_photo_path text,
  selfie_path text,
  id_uploaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.market_renter_verifications enable row level security;
-- Owners may see their own verification STATUS (paths are useless to
-- them — the bucket is private); writes via server actions only.
create policy market_verifications_own_read on public.market_renter_verifications
  for select to authenticated
  using (profile_id = auth.uid());

-- Short-lived SMS OTP codes (hashed; 10-min TTL enforced app-side).
create table if not exists public.market_phone_otp (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.market_phone_otp enable row level security;
-- Service-role only (no policies).

alter table public.market_listings
  add column if not exists instant_book boolean not null default false,
  add column if not exists proof_video_url text;
