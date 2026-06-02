-- customers.preferred_locale: per-customer language for SMS and email
-- templates. Defaults to 'en' so existing rows behave exactly as before.
--
-- Deploy-safety: additive column with a constant default. Postgres handles
-- this as a metadata-only change in modern versions, no full table rewrite.
-- No app-code dependency — the column is read where it's available and
-- falls back to 'en' if null.

alter table public.customers
  add column if not exists preferred_locale text not null default 'en';

-- Constrain to the locale set the dictionaries actually support so a
-- malformed value can't make it into the SMS / email pipeline.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_preferred_locale_chk'
  ) then
    alter table public.customers
      add constraint customers_preferred_locale_chk
      check (preferred_locale in ('en', 'fr', 'es', 'pt'));
  end if;
end $$;
