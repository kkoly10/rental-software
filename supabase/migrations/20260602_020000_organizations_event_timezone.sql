-- timezone: add organizations.event_timezone for TZ-aware event time
-- formatting + storage. Distinct from `timezone` which has been
-- semi-used for display only (and is the existing setting in
-- onboarding). event_timezone captures the IANA tz string that
-- event_start_time / event_end_time should be interpreted relative
-- to — needed for correct DST handling and operator-customer-display
-- alignment.
--
-- Defaults to the existing `timezone` value where it's set; falls back
-- to 'UTC' otherwise. Future PRs will thread this through storage of
-- event_start_time so it stops being treated as UTC-when-it-was-local.

alter table public.organizations
  add column if not exists event_timezone text not null default 'UTC';

update public.organizations
   set event_timezone = timezone
 where event_timezone = 'UTC'
   and timezone is not null
   and timezone <> '';

comment on column public.organizations.event_timezone is
  'IANA timezone (e.g. America/New_York) that event_start_time and event_end_time should be interpreted in. Set during onboarding; future writes to event_start_time should compose wall-clock + this TZ.';
