-- Add delivery metadata columns to orders table.
-- These fields capture site-specific delivery info collected at order creation:
-- surface type (determines anchoring), gate code (crew access), on-site contact,
-- and setup notes (hazards, HOA restrictions, power access, etc.).

alter table public.orders
  add column if not exists delivery_surface_type text
    check (delivery_surface_type in ('grass', 'concrete', 'asphalt', 'other')),
  add column if not exists delivery_gate_code text,
  add column if not exists delivery_contact_name text,
  add column if not exists delivery_contact_phone text,
  add column if not exists delivery_setup_notes text;

comment on column public.orders.delivery_surface_type is 'Setup surface: grass, concrete, asphalt, or other. Determines anchoring method.';
comment on column public.orders.delivery_gate_code is 'Gate or access code for the delivery location.';
comment on column public.orders.delivery_contact_name is 'On-site contact name (may differ from account holder).';
comment on column public.orders.delivery_contact_phone is 'On-site contact phone number.';
comment on column public.orders.delivery_setup_notes is 'Crew-facing setup notes: hazards, HOA rules, power access, slopes, etc.';
