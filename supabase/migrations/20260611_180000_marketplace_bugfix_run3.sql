-- Marketplace bug-hunt Run 3 (UI/data + storage).
--
-- #39 — Evidence photos were uploaded to the PUBLIC `uploads` bucket and
-- stored as world-readable getPublicUrl() links. Handoff/return evidence
-- is private dispute material (it can show people's property, homes, and
-- faces in reflections) and must never be reachable by a guessable URL.
-- Move it to a PRIVATE bucket, mirroring the market-identity pattern:
-- service-role writes only, reads via short-lived admin signed URLs.
--
-- Proof-of-function videos and listing photos are deliberately PUBLIC
-- listing media (rendered on the public listing page as trust signals,
-- exactly like the listing photo), so they stay in `uploads`. They are
-- protected from the storage-sweep cron by a separate code change that
-- adds market_listings.photo_url / proof_video_url to the referenced-path
-- set (#61).

-- Private bucket — NEVER public; access via admin signed URLs only.
insert into storage.buckets (id, name, public)
values ('market-evidence', 'market-evidence', false)
on conflict (id) do nothing;

-- No storage.objects policies: like market-identity, the bucket is
-- service-role only. Server actions upload with the admin client; reads
-- happen exclusively through createSignedUrl() in admin/dispute views.

-- The photo_url column now holds a PRIVATE-bucket storage PATH (not a
-- public URL). Document it so a future reader signs the path instead of
-- rendering it directly.
comment on column public.market_handoff_evidence.photo_url is
  'Storage PATH in the private market-evidence bucket (not a public URL). Read via admin createSignedUrl().';
