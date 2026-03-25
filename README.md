# RentalOS — Inflatable Rental Software

Web-first rental software purpose-built for inflatable rental businesses, with an architecture designed to expand into party rental and trailer rental workflows.

## What's included

### Public booking website
- Homepage with featured inventory and search bar
- Catalog browse with real-time category filtering via URL params
- Product detail pages with uploaded images, specs, and availability badges
- Checkout flow that creates customers, addresses, and orders with product linking
- Mobile-responsive layout

### Operator dashboard
- Daily overview with stats, recent orders, and quick actions
- **Orders** — full pipeline with statuses (inquiry → confirmed → delivered → completed)
- **Products** — CRUD with category, pricing, deposit, visibility, delivery settings, and image management (add/remove by URL, set primary)
- **Customers** — list with contact details, addresses, and order history
- **Payments** — deposit/balance tracking with manual payment recording (cash, check, card, Venmo, Zelle); auto-confirms orders when fully paid
- **Documents** — rental agreement and safety waiver management with mark-sent/mark-signed actions and generate-from-order flow
- **Delivery board** — kanban-style route management (assigned → in progress → completed)
- **Route detail** — stop sequence, crew assignment, vehicle info
- **Calendar** — upcoming events from order pipeline
- **Maintenance** — asset readiness queue (informational; CRUD not yet wired)
- **Service areas** — ZIP-based coverage with delivery fees and minimums
- **Settings** — editable business profile (name, email, phone, timezone)
- **Website** — editable homepage messaging, service area text, and booking presentation controls

### Crew mobile workspace
- Mobile-optimized route view for delivery crews
- Stop sequence with real status actions (mark en route → mark delivered → mark complete)
- Auto-completes route when all stops are done
- Setup checklist and photo/signature placeholders

### Auth and onboarding
- Email/password signup and login with Supabase Auth
- Middleware-protected dashboard routes with onboarding redirect
- Cookie-based SSR session handling via @supabase/ssr
- Onboarding flow that creates organization, membership, service area, and starter categories
- Duplicate onboarding prevention
- Sign out from dashboard sidebar

### Multi-tenancy and security
- Organization scoping via authenticated user's membership (not "first org in DB")
- Row-Level Security policies on all tenant-scoped tables
- Public storefront access for anonymous visitors (catalog, checkout)
- Helper function `get_user_org_ids()` for RLS policy evaluation

## Tech stack

- **Next.js** (App Router, Server Components, Server Actions)
- **TypeScript** (strict mode)
- **Supabase** (PostgreSQL, Auth, Row-Level Security)
- **@supabase/ssr** (cookie-based auth for SSR)
- **Vercel** deployment target
- **Custom CSS** (clean blue/white SaaS design system)

## Local setup

```bash
# 1. Clone and install
git clone <repo-url>
cd rental-software
npm install

# 2. Configure environment (optional — app runs with mock data without this)
cp .env.example .env.local
# Fill in your Supabase project URL and anon key

# 3. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | For live data | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For live data | Your Supabase anonymous/public key |

**Without these variables**, the app runs in demo mode with fallback mock data. All pages render correctly, all navigation works, and forms show validation — but data is not persisted.

## Supabase setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Run the migrations in order via the SQL Editor:
   ```
   supabase/migrations/20260324_120000_initial_schema.sql    — Full schema (19 tables)
   supabase/migrations/20260324_121500_auth_profile_sync.sql  — Profile auto-creation trigger
   supabase/migrations/20260325_010000_rls_policies.sql       — Row-Level Security policies
   supabase/migrations/20260325_020000_org_settings_payment_method.sql — Org settings + payment method columns
   ```
3. Copy your project URL and anon key to `.env.local`
4. Sign up through the app, complete onboarding, then start creating products and orders

### Migrations

| File | Purpose |
|---|---|
| `20260324_120000_initial_schema.sql` | Full schema with all 19 tables and indexes |
| `20260324_121500_auth_profile_sync.sql` | Trigger to auto-create profile rows on signup |
| `20260325_010000_rls_policies.sql` | Row-Level Security policies for multi-tenant isolation |
| `20260325_020000_org_settings_payment_method.sql` | Adds settings JSONB to organizations, payment_method/reference_note to payments |

## Order status flow

```
inquiry → quote_sent → awaiting_deposit → confirmed → scheduled →
out_for_delivery → delivered → pickup_pending → completed
                                                   ↘ cancelled / refunded
```

## Deployment (Vercel)

1. Push to GitHub
2. Connect repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy — builds with `next build`, no additional configuration needed

## Project structure

```
app/                          # Next.js App Router pages
  page.tsx                    # Public homepage
  inventory/                  # Public catalog with category filtering
  checkout/                   # Public booking flow
  login/ signup/ onboarding/  # Auth and setup
  dashboard/                  # Operator dashboard (13+ sections)
  crew/today/                 # Mobile crew workspace
components/
  layout/                     # PublicHeader, DashboardShell
  ui/                         # StatCard, StatusBadge
  public/                     # ProductCard, CatalogGrid
  auth/                       # LoginForm, SignupForm
  checkout/                   # CheckoutForm
  products/                   # ProductForm, ProductImageManager
  orders/                     # NewOrderForm
  payments/                   # RecordPaymentForm
  documents/                  # DocumentStatusButton, CreateDocumentsButton
  crew/                       # StopActionButtons
  settings/                   # BusinessProfileForm, WebsiteSettingsForm
  onboarding/                 # OnboardingForm
lib/
  data/                       # Server-side data fetchers with Supabase + fallbacks
  auth/                       # Auth server actions + org-context resolver
  checkout/                   # Checkout server action
  products/                   # Product CRUD + image management server actions
  orders/                     # Order creation server action
  payments/                   # Manual payment recording server action
  documents/                  # Document status + generation server actions
  crew/                       # Stop status update server action
  settings/                   # Business profile + website settings server actions
  onboarding/                 # Onboarding server action
  supabase/                   # Client and server Supabase clients
supabase/
  schema.sql                  # Reference schema
  migrations/                 # Incremental SQL migrations (4 files)
middleware.ts                 # Auth session refresh + route protection + onboarding redirect
```

## What is complete vs. scaffolded

### Complete (fully functional)
- Auth: signup, login, logout, session management
- Onboarding: org creation, membership, service area seeding, category seeding
- Products: create, edit, list, detail, category linkage, visibility, pricing, image management
- Orders: create (dashboard + public checkout), list, detail with financials
- Customers: list, detail with order history and addresses
- Checkout: full flow creating customer, address, order, and order items
- Payments: manual recording (cash, check, card, Venmo, Zelle), auto-confirm on full payment
- Documents: generate agreements/waivers per order, mark sent/signed with timestamps
- Delivery board: kanban view with route detail
- Route detail: stop sequence with crew/vehicle display
- Crew mobile: route view with real stop status actions (en route → delivered → complete)
- Catalog filtering: category-based filtering via URL params
- Product images: add/remove by URL, set primary, display on catalog and detail pages
- Settings: editable business profile (name, email, phone, timezone)
- Website: editable homepage messaging, service area text, booking message
- Service areas: list view
- Calendar: upcoming events from orders
- RLS policies: all tables protected
- Multi-tenant org scoping: all actions and data fetchers use authenticated user's org
- Demo mode: full app works with mock data when env vars are missing

### Scaffolded (UI present, backend integration deferred)
- Maintenance: hardcoded records, not yet reading from `maintenance_records` table
- E-signatures: document status tracked, no signing UI (mark sent/signed is manual)
- Email notifications: not integrated
- Map/routing: placeholder in delivery board
- Pagination: all queries use `.limit(50)`, no cursor-based pagination
- Stripe integration: manual payments supported, automated payment processing deferred

## Expansion roadmap

**v1** (current): Inflatable rental businesses — full booking pipeline, catalog management, delivery logistics, deposit/balance tracking

**v2**: Party rental expansion — package/bundle products, add-on line items, tent/table/chair inventory, labor charges

**v3**: Trailer rental expansion — serialized asset tracking, check-in/check-out, VIN/hitch/capacity attributes, mileage documentation

## License

Private — all rights reserved.
