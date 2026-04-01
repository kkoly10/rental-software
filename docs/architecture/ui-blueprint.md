# Korent UI Blueprint

## Design system

- **Color palette**: Blue/white SaaS theme with professional, modern feel
  - Primary: `#1e5dcf` (blue)
  - Background: `#f8fbff` gradient
  - Surface: `#ffffff`
  - Text: `#10233f`
  - Accent: `#20b486` (green for success states)
- **Typography**: System font stack (Apple, Segoe UI, Arial)
- **Border radius**: 18px for cards, 12px for inputs, 999px for buttons/badges
- **Shadows**: Soft layered shadows for depth
- **Not childish**: No bright party colors, clip art, or carnival themes

## Page hierarchy

### Public pages
1. **Homepage** (`/`) — hero with search bar, featured products, footer
2. **Inventory** (`/inventory`) — filter bar + product grid
3. **Product detail** (`/inventory/[slug]`) — image gallery, specs, reserve CTA
4. **Checkout** (`/checkout`) — customer form, event date, address, booking confirmation
5. **Login** (`/login`) — email/password
6. **Signup** (`/signup`) — name, phone, email, password
7. **Onboarding** (`/onboarding`) — business name, timezone, service area, auto-seed categories

### Dashboard pages (auth-protected)
1. **Dashboard home** (`/dashboard`) — stat cards, recent orders, quick actions
2. **Orders** (`/dashboard/orders`) — order list with status pipeline
3. **Order detail** (`/dashboard/orders/[id]`) — customer info, items, financials, documents
4. **New order** (`/dashboard/orders/new`) — manual booking creation form
5. **Products** (`/dashboard/products`) — product list with edit links
6. **Product detail/edit** (`/dashboard/products/[id]`) — full product form with category, pricing, visibility
7. **New product** (`/dashboard/products/new`) — product creation form
8. **Customers** (`/dashboard/customers`) — customer list with latest bookings
9. **Customer detail** (`/dashboard/customers/[id]`) — contact, address, order history
10. **Payments** (`/dashboard/payments`) — deposit/balance activity
11. **Documents** (`/dashboard/documents`) — agreement/waiver status per order
12. **Deliveries** (`/dashboard/deliveries`) — kanban board (assigned/in-progress/completed)
13. **Route detail** (`/dashboard/deliveries/[id]`) — stops, crew, vehicle
14. **Calendar** (`/dashboard/calendar`) — upcoming events list
15. **Maintenance** (`/dashboard/maintenance`) — asset readiness queue
16. **Service areas** (`/dashboard/service-areas`) — ZIP coverage with fees
17. **Website** (`/dashboard/website`) — homepage content controls
18. **Settings** (`/dashboard/settings`) — business profile, booking defaults, team roles

### Crew pages
1. **Crew today** (`/crew/today`) — mobile-framed route view with stop actions

## Component library

- `PublicHeader` — sticky topbar with logo and nav links
- `DashboardShell` — sidebar navigation + main content area
- `StatCard` — label, big number, meta text
- `StatusBadge` — colored pill (default/success/warning/danger)
- `ProductCard` — image placeholder, name, category, price, status, view link
- `CatalogGrid` — responsive grid of product cards
- `LoginForm` / `SignupForm` — auth forms with server action integration
- `CheckoutForm` — booking form with success state
- `ProductForm` — create/edit product with all fields
- `NewOrderForm` — manual order creation
- `OnboardingForm` — business setup wizard

## Responsive breakpoints

- Desktop: full sidebar, 4-column grids
- Tablet (< 980px): collapsed sidebar, 2-column grids
- Mobile (< 640px): stacked layout, single column
