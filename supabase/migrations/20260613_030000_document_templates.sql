-- Phase D — operator-editable document templates (full clause editor).
--
-- Until now the rental-agreement / safety-waiver clauses were hardcoded
-- per vertical in lib/documents/terms.ts. This table lets an operator
-- override those clauses for their own org. The PDF route prefers stored
-- clauses when a row exists; otherwise it falls back to the built-in
-- per-vertical defaults (getTerms). Resetting = deleting the row.
--
-- One row per (organization, document_type). `clauses` is an ordered
-- array of plain-text clause strings (no rich text).

create table if not exists public.document_templates (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  document_type   text not null check (document_type in ('rental_agreement', 'safety_waiver')),
  clauses         jsonb not null default '[]'::jsonb,
  updated_at      timestamptz not null default now(),
  primary key (organization_id, document_type)
);

-- RLS — mirrors organization_verticals: members can read their org's
-- templates; only owners/admins can write them.
alter table public.document_templates enable row level security;

drop policy if exists "Org members can view their document templates" on public.document_templates;
create policy "Org members can view their document templates"
  on public.document_templates for select
  using (organization_id in (select public.get_user_org_ids()));

drop policy if exists "Owners and admins can manage document templates" on public.document_templates;
create policy "Owners and admins can manage document templates"
  on public.document_templates for all
  using (
    organization_id in (
      select om.organization_id
      from public.organization_memberships om
      where om.profile_id = auth.uid()
        and om.status = 'active'
        and om.role in ('owner', 'admin')
    )
  );
