-- Atomic manual payment recording to prevent race conditions.
--
-- Two staff members simultaneously recording a payment for the same order would
-- both pass the JS-layer balance check (TOCTOU), leading to over-payment.
-- This function uses SELECT FOR UPDATE to lock the order row during validation
-- so only one payment insertion proceeds at a time.
--
-- Returns: { ok: boolean, message?: text, payment_id?: uuid, new_balance?: numeric }

create or replace function record_manual_payment(
  p_order_id       uuid,
  p_org_id         uuid,
  p_amount         numeric,
  p_payment_type   text,
  p_payment_method text,
  p_reference_note text default null,
  p_paid_at        timestamptz default now()
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order       record;
  v_total_paid  numeric;
  v_total_ref   numeric;
  v_net_paid    numeric;
  v_balance     numeric;
  v_new_id      uuid;
  v_new_balance numeric;
begin
  -- Lock the order row to serialize concurrent payment inserts
  select id, total_amount, order_status, organization_id
    into v_order
    from orders
   where id = p_order_id
     and organization_id = p_org_id
     for update;

  if not found then
    return json_build_object('ok', false, 'message', 'Order not found or access denied.');
  end if;

  -- Compute authoritative financial state inside the lock
  select
    coalesce(sum(case when payment_type != 'refund' then amount else 0 end), 0),
    coalesce(sum(case when payment_type  = 'refund' then amount else 0 end), 0)
    into v_total_paid, v_total_ref
    from payments
   where order_id = p_order_id
     and payment_status = 'paid';

  v_net_paid := greatest(0, v_total_paid - v_total_ref);
  v_balance  := greatest(0, coalesce(v_order.total_amount, 0) - v_net_paid);

  -- Validate
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

  -- Insert payment record
  insert into payments (
    order_id, provider, payment_type, payment_status,
    amount, payment_method, reference_note, paid_at
  ) values (
    p_order_id, 'manual', p_payment_type, 'paid',
    p_amount, p_payment_method, p_reference_note, p_paid_at
  )
  returning id into v_new_id;

  -- Recompute and cache new balance
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
$$;
