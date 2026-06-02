-- security: drop the storage.objects SELECT policy that allowed anon to
-- LIST every file in the public product-images bucket. Direct
-- public-URL access via the storage CDN does not require a SELECT
-- policy on storage.objects (the bucket is public). Removing the
-- policy removes the listing capability without breaking image URLs.
drop policy if exists "Public product images are viewable" on storage.objects;
