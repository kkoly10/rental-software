-- #62 — Marketplace listing media was uploaded to the `uploads` bucket
-- and served via getPublicUrl(), but `uploads` is PRIVATE by design
-- (phase0_security: crew delivery-proof photos, org-scoped reads). A
-- public-URL link into a private bucket returns 400 — every listing
-- photo and proof-of-function video would render broken in production.
--
-- Fix: a dedicated PUBLIC bucket for media that is *meant* to be public
-- (listing photos, proof-of-function videos — the storefront's face).
-- Server actions write with the service-role client; no storage.objects
-- policies, so authenticated users cannot write into it directly.
-- The storage-sweep cron does not walk this bucket, so marketplace
-- media is also safe from orphan deletion (#61).
--
-- Private material stays out: evidence → market-evidence (private),
-- identity → market-identity (private).

insert into storage.buckets (id, name, public)
values ('market-media', 'market-media', true)
on conflict (id) do nothing;
