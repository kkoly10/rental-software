-- Marketplace M5 — conversations/messages (§18/§26) + disputes (§17).

-- ── Conversations: one thread per renter × listing (§18 "one
--    continuous thread across inquiry → booking → support") ──────────
create table if not exists public.market_conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.market_listings(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  renter_profile_id uuid not null references public.profiles(id) on delete cascade,
  booking_id uuid references public.market_bookings(id) on delete set null,
  -- §18 phase, simplified to the two moderation-relevant phases at
  -- launch; the full phase ladder layers on without schema change.
  phase text not null default 'inquiry' check (phase in ('inquiry','coordination')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, renter_profile_id)
);

create index if not exists market_conversations_org_idx
  on public.market_conversations (organization_id, updated_at desc);
create index if not exists market_conversations_renter_idx
  on public.market_conversations (renter_profile_id, updated_at desc);

alter table public.market_conversations enable row level security;
create policy market_conversations_party_read on public.market_conversations
  for select to authenticated
  using (
    renter_profile_id = auth.uid()
    or organization_id in (select public.get_user_org_ids())
  );

-- ── Messages (writes via server actions only — §26 controlled paths) ─
create table if not exists public.market_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.market_conversations(id) on delete cascade,
  sender_party text not null check (sender_party in ('renter','seller','system','admin')),
  sender_profile_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  moderation text not null default 'clean' check (moderation in ('clean','soft_warn')),
  moderation_reasons text[],
  created_at timestamptz not null default now()
);

create index if not exists market_messages_conversation_idx
  on public.market_messages (conversation_id, created_at);

alter table public.market_messages enable row level security;
create policy market_messages_party_read on public.market_messages
  for select to authenticated
  using (
    conversation_id in (
      select c.id from public.market_conversations c
      where c.renter_profile_id = auth.uid()
         or c.organization_id in (select public.get_user_org_ids())
    )
  );

-- Blocked messages are NEVER stored — the send action rejects them.
-- Soft-warned messages store their reasons for trust scoring (§21).

-- ── Disputes / claims (§17) ──────────────────────────────────────────
create table if not exists public.market_disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.market_bookings(id) on delete cascade,
  opened_by text not null check (opened_by in ('renter','seller')),
  opener_profile_id uuid references public.profiles(id) on delete set null,
  dispute_type text not null check (dispute_type in
    ('item_not_working','damage','missing_accessories','late_return','non_return',
     'condition_mismatch','seller_no_show','renter_no_show','billing_issue')),
  status text not null default 'open' check (status in
    ('open','awaiting_renter_evidence','awaiting_seller_evidence','admin_review',
     'resolved_renter_liable','resolved_seller_liable','resolved_split',
     'resolved_no_fault','closed')),
  description text not null check (char_length(description) between 10 and 2000),
  resolution_note text check (char_length(resolution_note) <= 2000),
  -- §9/§17: how much of the deposit auth was captured toward the claim.
  deposit_captured_cents integer not null default 0 check (deposit_captured_cents >= 0),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists market_disputes_booking_idx
  on public.market_disputes (booking_id);
create index if not exists market_disputes_open_idx
  on public.market_disputes (status, created_at)
  where status in ('open','awaiting_renter_evidence','awaiting_seller_evidence','admin_review');

alter table public.market_disputes enable row level security;
create policy market_disputes_party_read on public.market_disputes
  for select to authenticated
  using (
    booking_id in (
      select b.id from public.market_bookings b
      where b.renter_profile_id = auth.uid()
         or b.organization_id in (select public.get_user_org_ids())
    )
  );
