-- timezone phase 2: recompute event_start_time / event_end_time
-- using each org's event_timezone, now that the new app code is
-- deployed and reads expect the timestamptz to be the true UTC
-- instant of the operator's wall-clock.
--
-- DO NOT APPLY THIS MIGRATION BEFORE THE APP DEPLOY THAT PAIRS
-- WITH MIGRATION 20260602_060000. If you do, every non-UTC org's
-- existing orders will display the wrong time on the production
-- dashboard / portal / emails (which on `main` still treat
-- event_start_time as wall-clock-as-UTC), until the deploy lands.
--
-- For orgs whose event_timezone is 'UTC' (the default), this is a
-- no-op. For real-TZ orgs it shifts event_start_time to the
-- correct UTC instant of the operator's wall-clock.

update public.orders o
   set event_start_time =
         (o.event_date::timestamp without time zone + o.event_start_local)
         at time zone coalesce(org.event_timezone, 'UTC')
  from public.organizations org
 where org.id = o.organization_id
   and o.event_date is not null
   and o.event_start_local is not null;

update public.orders o
   set event_end_time =
         (o.event_date::timestamp without time zone + o.event_end_local)
         at time zone coalesce(org.event_timezone, 'UTC')
  from public.organizations org
 where org.id = o.organization_id
   and o.event_date is not null
   and o.event_end_local is not null;
