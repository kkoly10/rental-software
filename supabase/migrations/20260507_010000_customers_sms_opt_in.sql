-- Add SMS opt-in tracking to customers for TCPA compliance
alter table customers
  add column if not exists sms_opt_in boolean not null default false,
  add column if not exists sms_opt_in_at timestamptz,
  add column if not exists sms_opt_in_ip text;
