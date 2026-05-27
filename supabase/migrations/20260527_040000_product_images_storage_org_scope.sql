-- Scope product-images bucket writes to the uploader's own org folder.
-- Objects are stored at "{organization_id}/...", but the original policies only
-- checked bucket_id, so any authenticated user could upload/overwrite/delete
-- into another org's folder via the storage API directly. SELECT stays public
-- (images are public). storage.foldername(name)[1] is the leading org-id folder.

drop policy if exists "Authenticated users can upload product images" on storage.objects;
create policy "Authenticated users can upload product images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select organization_id::text
      from public.organization_memberships
      where profile_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "Authenticated users can update product images" on storage.objects;
create policy "Authenticated users can update product images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select organization_id::text
      from public.organization_memberships
      where profile_id = auth.uid() and status = 'active'
    )
  );

drop policy if exists "Authenticated users can delete product images" on storage.objects;
create policy "Authenticated users can delete product images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] in (
      select organization_id::text
      from public.organization_memberships
      where profile_id = auth.uid() and status = 'active'
    )
  );
