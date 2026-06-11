-- Marketplace M4 (first slice) — handoff/return evidence (spec §16).
--
-- Evidence rows are linked to the booking and preserved for disputes.
-- Both parties submit at both phases; capture UI lands next slice —
-- the table ships first so lifecycle actions can log structured
-- evidence events against it from day one.

create table if not exists public.market_handoff_evidence (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.market_bookings(id) on delete cascade,
  phase text not null check (phase in ('handoff','return')),
  party text not null check (party in ('seller','renter')),
  photo_url text,
  note text check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists market_evidence_booking_idx
  on public.market_handoff_evidence (booking_id, phase);

alter table public.market_handoff_evidence enable row level security;

-- Both booking parties can read the evidence trail (it ends disputes
-- before they start); writes go through server actions only.
create policy market_evidence_party_read on public.market_handoff_evidence
  for select to authenticated
  using (
    booking_id in (
      select b.id from public.market_bookings b
      where b.renter_profile_id = auth.uid()
         or b.organization_id in (select public.get_user_org_ids())
    )
  );
