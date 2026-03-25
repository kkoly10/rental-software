# RentalOS — Inflatable Rental Software

Web-first rental software purpose-built for inflatable rental businesses, with an architecture designed to expand into party rental and trailer rental workflows.

## What's included

### Public booking website
- Homepage with featured inventory and search bar
- Catalog browse with category filters
- Product detail pages with specs and availability badges
- Checkout flow that creates customers, addresses, and orders
- Mobile-responsive layout

### Operator dashboard
- Daily overview with stats, recent orders, and quick actions
- **Orders** — full pipeline with statuses (inquiry → confirmed → delivered → completed)
- **Products** — CRUD with category, pricing, deposit, visibility, and delivery settings
- **Customers** — list with contact details, addresses, and order history
- **Payments** — deposit/balance tracking per order
- **Documents** — rental agreement and safety waiver status tracking
- **Delivery board** — kanban-style route management (assigned → in progress → completed)
- **Route detail** — stop sequence, crew assignment, vehicle info
- **Calendar** — upcoming events from order pipeline
- **Maintenance** — asset readiness queue
- **Service areas** — ZIP-based coverage with delivery fees and minimums
- **Settings** — business profile and team access structure
- **Website** — homepage and catalog presentation controls

### Crew mobile workspace
- Mobile-optimized route view for delivery crews
- Stop sequence with navigate, call, and mark-complete actions
- Setup checklist and photo/signature placeholders

### Auth and onboarding
- Email/password signup and login with Supabase Auth
- Middleware-protected dashboard routes
- Cookie-based SSR session handling
- Onboarding flow that creates organization, membership, service area, and starter categories

## Tech stack

- **Next.js** (App Router, Server Components, Server Actions)
- **TypeScript** (strict mode)
- **Supabase** (PostgreSQL, Auth, Row-Level Security ready)
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
2. Run the initial schema migration:
   ```sql
   -- Run the contents of supabase/migrations/20260324_120000_initial_schema.sql
   ```
3. Run the auth profile sync trigger:
   ```sql
   -- Run the contents of supabase/migrations/20260324_121500_auth_profile_sync.sql
   ```
4. Copy your project URL and anon key to `.env.local`
5. Sign up through the app, complete onboarding, then start creating products and orders

### Migrations

| File | Purpose |
|---|---|
| `20260324_120000_initial_schema.sql` | Full schema with all tables and indexes |
| `20260324_121500_auth_profile_sync.sql` | Trigger to auto-create profile rows on signup |

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
  inventory/                  # Public catalog
  checkout/                   # Public booking flow
  login/ signup/ onboarding/  # Auth and setup
  dashboard/                  # Operator dashboard (13 sections)
  crew/today/                 # Mobile crew workspace
components/
  layout/                     # PublicHeader, DashboardShell
  ui/                         # StatCard, StatusBadge
  public/                     # ProductCard, CatalogGrid
  auth/                       # LoginForm, SignupForm
  checkout/                   # CheckoutForm
  products/                   # ProductForm (create/edit)
  orders/                     # NewOrderForm
  onboarding/                 # OnboardingForm
lib/
  data/                       # Server-side data fetchers with Supabase + fallbacks
  auth/                       # Auth server actions
  checkout/                   # Checkout server action
  products/                   # Product CRUD server actions
  orders/                     # Order creation server action
  onboarding/                 # Onboarding server action
  supabase/                   # Client and server Supabase clients
supabase/
  schema.sql                  # Reference schema
  migrations/                 # Incremental SQL migrations
middleware.ts                 # Auth session refresh + route protection
```

## What still depends on external services

| Feature | Dependency | Status |
|---|---|---|
| Live data persistence | Supabase project | Scaffolded, works with env vars |
| User authentication | Supabase Auth | Fully wired with SSR cookies |
| File uploads (images) | Supabase Storage | Schema ready, upload UI not yet built |
| Payment processing | Stripe (future) | Deposit amounts tracked in DB |
| E-signatures | Third-party (future) | Document status tracked, signing UI not built |
| Email notifications | SendGrid/Resend (future) | Not integrated |
| Map/routing | Google Maps (future) | Placeholder in delivery board |

## Expansion roadmap

**v1** (current): Inflatable rental businesses — full booking pipeline, catalog management, delivery logistics, deposit/balance tracking

**v2**: Party rental expansion — package/bundle products, add-on line items, tent/table/chair inventory, labor charges

**v3**: Trailer rental expansion — serialized asset tracking, check-in/check-out, VIN/hitch/capacity attributes, mileage documentation

## License

Private — all rights reserved.
