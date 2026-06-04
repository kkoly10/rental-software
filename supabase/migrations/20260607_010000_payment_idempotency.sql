-- Add idempotency_key to payments and dedupe inside record_manual_payment
-- so a double-click on the Copilot Apply button (or an HTTP retry on a
-- network blip) cannot insert two payment rows for the same logical action.
-- The Copilot client generates a UUID once per [ACTION:...] block; the
-- server passes it to the RPC. If a row with the same (order_id, key)
-- already exists, the RPC returns the existing payment_id with
-- duplicate=true instead of inserting a second row.

alter table public.payments
  add column if not exists idempotency_key uuid;

-- Partial unique index — null keys (manual dashboard entry, legacy rows)
-- are not deduped; only requests that explicitly carry a key are.
create unique index if not exists payments_order_idempotency_key_uidx
  on public.payments (order_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.record_manual_payment(
  p_order_id uuid,
  p_org_id uuid,
  p_amount numeric,
  p_payment_type text,
  p_payment_method text,
  p_reference_note text default null::text,
  p_paid_at timestamptz default now(),
  p_idempotency_key uuid default null
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order        record;
  v_total_paid   numeric;
  v_total_ref    numeric;
  v_net_paid     numeric;
  v_balance      numeric;
  v_new_id       uuid;
  v_new_balance  numeric;
  v_existing_id  uuid;
begin
  if not exists (
    select 1
    from public.organization_memberships
    where organization_id = p_org_id
      and profile_id = auth.uid()
      and status = 'active'
      and role in ('owner', 'admin', 'dispatcher')
  ) then
    return json_build_object('ok', false, 'message', 'Not authorized for this organization.');
  end if;

  -- Idempotency short-circuit: if a payment already exists for this
  -- (order, key) tuple, return it without touching anything else.
  if p_idempotency_key is not null then
    select id
      into v_existing_id
      from public.payments
     where order_id = p_order_id
       and idempotency_key = p_idempotency_key
     limit 1;
    if found then
      select greatest(0, coalesce(o.total_amount, 0) -
        greatest(0,
          coalesce(sum(case when payment_type != 'refund' then amount else 0 end), 0) -
          coalesce(sum(case when payment_type  = 'refund' then amount else 0 end), 0)
        ))
        into v_new_balance
        from public.payments p
        join public.orders o on o.id = p.order_id
       where p.order_id = p_order_id and p.payment_status = 'paid'
       group by o.total_amount;
      return json_build_object(
        'ok',          true,
        'payment_id',  v_existing_id,
        'new_balance', coalesce(v_new_balance, 0),
        'duplicate',   true
      );
    end if;
  end if;

  select id, total_amount, order_status, organization_id
    into v_order
    from public.orders
   where id = p_order_id
     and organization_id = p_org_id
     for update;

  if not found then
    return json_build_object('ok', false, 'message', 'Order not found or access denied.');
  end if;

  select
    coalesce(sum(case when payment_type != 'refund' then amount else 0 end), 0),
    coalesce(sum(case when payment_type  = 'refund' then amount else 0 end), 0)
    into v_total_paid, v_total_ref
    from public.payments
   where order_id = p_order_id
     and payment_status = 'paid';

  v_net_paid := greatest(0, v_total_paid - v_total_ref);
  v_balance  := greatest(0, coalesce(v_order.total_amount, 0) - v_net_paid);

  if p_payment_type != 'refund' and p_amount > v_balance then
    return json_build_object(
      'ok', false,
      'message', format(
        'Payment amount ($%s) exceeds outstanding balance ($%s).',
        to_char(p_amount, 'FM99999990.00'),
        to_char(v_balance, 'FM99999990.00')
      )
    );
  end if;

  if p_payment_type = 'refund' and p_amount > v_total_paid then
    return json_build_object(
      'ok', false,
      'message', format(
        'Refund ($%s) exceeds total payments received ($%s).',
        to_char(p_amount, 'FM99999990.00'),
        to_char(v_total_paid, 'FM99999990.00')
      )
    );
  end if;

  insert into public.payments (
    order_id, provider, payment_type, payment_status,
    amount, payment_method, reference_note, paid_at, idempotency_key
  ) values (
    p_order_id, 'manual', p_payment_type, 'paid',
    p_amount, p_payment_method, p_reference_note, p_paid_at, p_idempotency_key
  )
  returning id into v_new_id;

  select greatest(0, coalesce(v_order.total_amount, 0) -
    greatest(0,
      coalesce(sum(case when payment_type != 'refund' then amount else 0 end), 0) -
      coalesce(sum(case when payment_type  = 'refund' then amount else 0 end), 0)
    ))
    into v_new_balance
    from public.payments
   where order_id = p_order_id and payment_status = 'paid';

  update public.orders
     set balance_due_amount = v_new_balance
   where id = p_order_id;

  return json_build_object(
    'ok',          true,
    'payment_id',  v_new_id,
    'new_balance', v_new_balance,
    'net_paid',    v_net_paid + (case when p_payment_type != 'refund' then p_amount else -p_amount end),
    'duplicate',   false
  );
end;
$function$;

-- The old signature stays revoked (it was revoked from public in
-- 20260601_090000); the new signature inherits the public.execute
-- defaults — only authenticated callers can hit it, and the membership
-- check is the security boundary.
revoke execute on function public.record_manual_payment(
  uuid, uuid, numeric, text, text, text, timestamptz
) from public;
