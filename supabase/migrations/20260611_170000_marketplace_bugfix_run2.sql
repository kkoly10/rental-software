-- Bug-hunt Run 2 (trust/security) fixes.

-- #45/#59: per-conversation leakage score so repeated off-platform
-- probing escalates instead of being a consequence-free retry loop.
-- Crossing the threshold flags the thread into the trust queue.
alter table public.market_conversations
  add column if not exists leakage_score integer not null default 0,
  add column if not exists flagged_at timestamptz;

create index if not exists market_conversations_flagged_idx
  on public.market_conversations (flagged_at)
  where flagged_at is not null;

-- #52/#53: OTP brute-force cap must survive resends. Track cumulative
-- failed attempts and the last send time per profile, independent of
-- the per-code row that resets on each send.
alter table public.market_phone_otp
  add column if not exists cumulative_failures integer not null default 0,
  add column if not exists last_sent_at timestamptz;
