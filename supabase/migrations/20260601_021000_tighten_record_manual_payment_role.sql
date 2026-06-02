-- security: tighten role check on record_manual_payment to match the
-- app-layer gate in lib/payments/actions.ts (owner/admin/dispatcher).
-- The base membership check from 20260601_020000 blocks anon and
-- cross-org callers; this adds defense in depth so a crew or viewer
-- member can't call the RPC directly via PostgREST/JS SDK to fabricate
-- payments. Roles are not enforced by a CHECK constraint on
-- organization_memberships.role — list of valid roles taken from
-- lib/team/actions.ts (VALID_ROLES + owner).

create or replace function public.record_manual_payment(
  p_order_id uuid,
  p_org_id uuid,
  p_amount numeric,
  p_payment_type text,
  p_payment_method text,
  p_reference_note text default null::text,
  p_paid_at timestamptz default now()
)
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order       record;
  v_total_paid  numeric;
  v_total_ref   numeric;
  v_net_paid    numeric;
  v_balance     numeric;
  v_new_id      uuid;
  v_new_balance numeric;
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

  select id, total_amount, order_status, organization_id
    into v_order
    from orders
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
    from payments
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

  insert into payments (
    order_id, provider, payment_type, payment_status,
    amount, payment_method, reference_note, paid_at
  ) values (
    p_order_id, 'manual', p_payment_type, 'paid',
    p_amount, p_payment_method, p_reference_note, p_paid_at
  )
  returning id into v_new_id;

  select greatest(0, coalesce(v_order.total_amount, 0) -
    greatest(0,
      coalesce(sum(case when payment_type != 'refund' then amount else 0 end), 0) -
      coalesce(sum(case when payment_type  = 'refund' then amount else 0 end), 0)
    ))
    into v_new_balance
    from payments
   where order_id = p_order_id and payment_status = 'paid';

  update orders
     set balance_due_amount = v_new_balance
   where id = p_order_id;

  return json_build_object(
    'ok',          true,
    'payment_id',  v_new_id,
    'new_balance', v_new_balance,
    'net_paid',    v_net_paid + (case when p_payment_type != 'refund' then p_amount else -p_amount end)
  );
end;
$function$;
