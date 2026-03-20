# Rental Software

Inflatable-first rental software designed to grow into party rental and trailer rental workflows.

## Product direction

This repo starts with a web-first architecture built around:

- public booking website
- operator dashboard
- crew mobile workspace
- shared rental engine that can later support party rentals and trailer rentals

## Current foundation

This initial scaffold includes:

- Next.js app router project shell
- homepage, inventory, product detail, checkout, dashboard, delivery board, and crew mobile starter screens
- saved database and UI blueprint docs
- starter Supabase schema for the multi-tenant rental engine

## Planned build order

1. Public booking flow
2. Operator dashboard core
3. Delivery and crew workflows
4. Supabase integration
5. Payments, documents, and production deployment

## Key docs

- `docs/architecture/database-schema.md`
- `docs/architecture/ui-blueprint.md`
- `supabase/schema.sql`

## Local setup

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Notes

Version 1 is optimized for inflatable rental businesses, but the core data model is intentionally future-ready for:

- party packages and add-ons
- serialized trailer assets
- inspections and maintenance workflows
- delivery-heavy operations
