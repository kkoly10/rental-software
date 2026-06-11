-- Marketplace facilitator tax + marketplace-only sellers.
--
-- DC, MD, and VA all have marketplace-facilitator laws (DC since
-- 2019-04-01; VA Code §58.1-612.1; MD Tax-General §11-403) and all
-- three tax rentals of tangible personal property. The platform
-- collects tax from the renter and remits it — tax is part of the
-- charge but NEVER part of the seller payout. Rates live in
-- lib/market/tax.ts (config-as-code, dated like the §31 gates).

alter table public.market_seller_profiles
  add column if not exists state_code text not null default 'DC'
    check (state_code in ('DC','MD','VA'));

alter table public.market_bookings
  add column if not exists tax_cents integer not null default 0 check (tax_cents >= 0),
  add column if not exists tax_state_code text;
