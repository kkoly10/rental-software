-- security: scope product_images / product_attributes anon SELECT to
-- the same is_active + visibility filter that public.products uses.
-- Previously qual=true exposed media/attributes for inactive and
-- non-public products (drafts, hidden items).

drop policy if exists "Anon can view product images" on public.product_images;
create policy "Anon can view images of public active products"
  on public.product_images
  for select
  to anon
  using (
    deleted_at is null
    and product_id in (
      select id from public.products
      where is_active = true and visibility = 'public'
    )
  );

drop policy if exists "Anon can view product attributes" on public.product_attributes;
create policy "Anon can view attributes of public active products"
  on public.product_attributes
  for select
  to anon
  using (
    product_id in (
      select id from public.products
      where is_active = true and visibility = 'public'
    )
  );
