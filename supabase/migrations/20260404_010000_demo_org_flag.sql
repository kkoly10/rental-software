-- Add is_demo flag to organizations for the public demo storefront.
-- Demo orgs are fully browseable but write-protected for public visitors.
alter table organizations add column if not exists is_demo boolean not null default false;
