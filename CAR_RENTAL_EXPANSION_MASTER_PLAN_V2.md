# Rental Software — Car Rental Expansion Master Plan V2

## Purpose

This document is the implementation handoff for evolving `kkoly10/rental-software` into a multi-vertical rental platform that can support car rental without damaging the current inflatable / party rental product.

The goal is:

```txt
Rental Core + Car Rental Vertical Adapter
```

not:

```txt
Inflatable rental app hacked into a car rental app
```

This plan is intentionally more architectural than a feature ticket. It is meant to prevent a 6-month refactor after the first real car rental operators start using the product.

---

## Master Assessment

A car-rental expansion can create major maintenance problems if the repo does not clearly separate these layers:

1. generic rental core
2. vertical configuration
3. car-specific vehicle records
4. renter verification
5. agreement/signature workflow
6. payment/deposit/hold workflow
7. tokenized renter portal
8. pickup / lockbox / access release
9. condition photos and dispute evidence
10. return review and post-rental charges
11. audit/event history
12. storage/RLS/security rules

This V2 plan treats car rental as a vertical module on top of the existing rental engine.

---

## Source Repo Decision

### Base repo

Use:

```txt
kkoly10/rental-software
```

### Why this repo

Car rental is a rental transaction workflow first:

```txt
Browse → reserve → verify renter → sign agreement → pay/deposit → pickup → return → inspect → charge/complete
```

The `rental-software` repo already has the correct foundation:

```txt
public catalog
checkout
customers
orders
order_items
availability_blocks
payments
documents
operator dashboard
maintenance_records
inspections
routes
route_stops
multi-tenancy
RLS
Supabase Auth
Stripe
Resend
```

The `Fleet-management-` repo is better for dispatch and fleet operations. It should be used later for fleet intelligence, maintenance, health scoring, and operational dashboards, not as the base for car rental.

### Donor repos / references

Use `kkoly10/couranr-os` for workflow ideas:

```txt
renter verification
license front/back/selfie/insurance upload
admin approve/deny
agreement signed gate
paid gate
lockbox release
condition photos
GPS/time-stamped evidence
rental cancellation flow
```

Use `kkoly10/Fleet-management-` later for:

```txt
maintenance reminders
vehicle health
fleet cost reporting
permission/capability patterns
plan/module entitlement ideas
geolocation/tracking patterns
```

Do not merge repositories directly.

---

## Product Vision

Build:

```txt
Car Rental OS for small independent car rental operators
```

Target customers:

```txt
small local rental companies
Turo-style hosts with multiple cars
rideshare rental operators
dealership loaner fleets
small replacement/rental fleets
luxury/exotic rental operators later
trailer + car mixed rental businesses
```

Main wedge:

```txt
Booking → verification → agreement → payment/deposit → contactless pickup → condition photos → return → charges/dispute package
```

This is not generic fleet management. It is rental operations.

---

## Architecture North Star

The platform should become:

```txt
Multi-vertical Rental Operating System
```

Core architecture:

```txt
Rental Core
├── Organizations / Tenancy
├── Customers
├── Products / Listings
├── Assets / Serialized Units
├── Orders / Reservations
├── Availability
├── Pricing
├── Payments
├── Documents
├── Inspections
├── Routes / Delivery / Pickup
├── Notifications
├── Audit Events
└── Vertical Adapters
    ├── Party Rental
    ├── Trailer Rental
    ├── Car Rental
    └── Equipment Rental later
```

Car rental should be powered by the same generic rental core, but with a car-rental vertical adapter.

---

## Non-Negotiable Engineering Rules

1. **Do not create a separate car rental app.** Car rental must live inside the rental platform.
2. **Do not replace generic rental names everywhere.** Keep `products`, `assets`, `orders`, `order_items`, `availability_blocks`, `payments`, `documents`, and `inspections` generic.
3. **Do not hard-code car rental language into generic components.** Use vertical config and labels.
4. **Do not break current party/inflatable customers.** Existing checkout, dashboard, product management, and public catalog must continue working.
5. **Do not build car rental UI before vertical config and schema boundaries are clear.**
6. **Do not expose sensitive renter documents through public URLs.** Licenses, selfies, and insurance cards require strict access rules.
7. **Do not store full license numbers unless legally required.** Use last 4 / masked fields.
8. **Do not release lockbox/access instructions without server-side gate checks.** Hidden buttons are not security.
9. **Do not assume one payment is enough.** Car rentals need deposits, holds, incidentals, extensions, refunds, damage fees, tolls, tickets, and post-rental charges.
10. **Do not skip audit/event history.** Rental disputes require a timeline.
11. **Do not make renter account creation mandatory in MVP.** Use secure tokenized renter access links.
12. **Do not build pricing as flat-day only.** Plan for daily, weekly, monthly, mileage, deposit, delivery, protection add-ons, and fees.
13. **Do not assume all rentals are delivered.** Support pickup, delivery, contactless lockbox pickup, manual handoff, and return flows.
14. **Do not duplicate release-gate logic in UI and backend.** Use a shared server helper.
15. **Do not couple car rental to Stripe Checkout only.** Design so Stripe PaymentIntents and authorization holds can be added later.

---

## Current Generic Model Mapping

| Generic concept | Party rental meaning | Car rental meaning |
|---|---|---|
| `organization` | inflatable business | car rental operator |
| `product` | bounce house listing | vehicle listing or class |
| `asset` | serialized inflatable/trailer | individual vehicle/VIN |
| `order` | event booking | rental reservation |
| `order_item` | rented unit line | booked vehicle/listing |
| `availability_block` | booked event date | booked vehicle/date range |
| `customer` | party customer | renter |
| `payment` | deposit/balance | payment/deposit/fee/refund |
| `document` | waiver/agreement | agreement/license/insurance |
| `inspection` | asset condition check | pickup/return inspection |
| `maintenance_record` | asset repair | vehicle repair/service |
| `route` | delivery route | pickup/dropoff logistics |
| `route_stop` | delivery/pickup stop | handoff/return stop |

---

## Vertical Architecture

### Do not rely on only `organizations.business_type` forever

If the repo already has:

```txt
organizations.business_type
```

that is acceptable for Phase 1.

Long-term, one organization may support multiple verticals:

```txt
party rentals + trailer rentals
trailer rentals + car rentals
car rentals + equipment rentals
```

### Recommended future table: `organization_verticals`

Only add this when Phase 0 recon shows it is needed.

```sql
create table if not exists organization_verticals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  vertical_key text not null,
  status text not null default 'active',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, vertical_key)
);

create index if not exists idx_organization_verticals_org
  on organization_verticals(organization_id);

create index if not exists idx_organization_verticals_key_status
  on organization_verticals(vertical_key, status);
```

Vertical keys:

```txt
party_rental
trailer_rental
car_rental
equipment_rental
```

Status values:

```txt
active
trialing
disabled
archived
```

### Vertical config helper

Create:

```txt
lib/verticals/config.ts
```

Suggested shape:

```ts
export const RENTAL_VERTICALS = [
  "party_rental",
  "trailer_rental",
  "car_rental",
  "equipment_rental",
] as const;

export type RentalVertical = (typeof RENTAL_VERTICALS)[number];

export type RentalVerticalConfig = {
  key: RentalVertical;
  label: string;
  labels: {
    product: string;
    products: string;
    asset: string;
    assets: string;
    order: string;
    orders: string;
    customer: string;
    customers: string;
  };
  features: {
    requiresSerializedAssets: boolean;
    requiresRenterVerification: boolean;
    supportsMileage: boolean;
    supportsDeposits: boolean;
    supportsAuthorizationHolds: boolean;
    supportsProtectionPlans: boolean;
    supportsConditionPhotos: boolean;
    supportsLockboxAccess: boolean;
    supportsDelivery: boolean;
    supportsPickup: boolean;
    supportsReturnInspection: boolean;
    supportsPostRentalCharges: boolean;
  };
};
```

This lets generic UI eventually use correct labels without hard-coded car rental text.

---

## Product / Asset Modeling Decision

Car rental has two common models.

### Model A — product is the exact car

Example:

```txt
2019 Tesla Model 3
```

Best for small operators with unique vehicles.

### Model B — product is a class, asset is assigned later

Example:

```txt
Economy Car
Midsize SUV
Luxury Sedan
```

Best for larger operators.

### Recommendation

Support both long-term.

A product can represent:

```txt
specific_asset_listing
vehicle_class
```

Suggested helper:

```txt
lib/car-rental/listing-mode.ts
```

Functions:

```ts
isSpecificVehicleListing(product)
requiresAssetAssignment(product)
resolveBookableAsset(product, selectedAssetId)
```

Do not hard-code one model.

---

## Core Car Rental-Specific Schema

Phase 2 should add car-specific tables only after Phase 0/1 recon confirms existing schema conventions.

All car-rental tables must be tenant-scoped by `organization_id`.

### 1. `vehicle_profiles`

Extends generic `assets`.

```sql
create table if not exists vehicle_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,

  vin text,
  plate text,
  plate_state text,
  year integer,
  make text,
  model text,
  trim text,
  color text,
  body_type text,
  fuel_type text,
  transmission text,

  odometer integer,
  seat_count integer,
  door_count integer,

  registration_expires_at date,
  inspection_expires_at date,
  insurance_expires_at date,

  rental_status text not null default 'available',
  telematics_provider text,
  telematics_vehicle_id text,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, asset_id)
);

create index if not exists idx_vehicle_profiles_org
  on vehicle_profiles(organization_id);

create index if not exists idx_vehicle_profiles_asset
  on vehicle_profiles(asset_id);

create index if not exists idx_vehicle_profiles_vin
  on vehicle_profiles(organization_id, vin);

create index if not exists idx_vehicle_profiles_plate
  on vehicle_profiles(organization_id, plate);

create index if not exists idx_vehicle_profiles_status
  on vehicle_profiles(organization_id, rental_status);
```

Status values:

```txt
available
reserved
rented
maintenance
cleaning
damage_review
unavailable
retired
sold
```

### 2. `vehicle_rental_policies`

Policy can be per product, per asset, or org default.

```sql
create table if not exists vehicle_rental_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  asset_id uuid references assets(id) on delete cascade,

  minimum_renter_age integer,
  minimum_rental_days integer not null default 1,
  maximum_rental_days integer,

  daily_rate numeric(10,2),
  weekly_rate numeric(10,2),
  monthly_rate numeric(10,2),

  security_deposit_amount numeric(10,2) not null default 0,
  deposit_mode text not null default 'manual_record',

  mileage_included_per_day integer,
  mileage_overage_rate numeric(10,2),

  fuel_policy text not null default 'same_as_pickup',
  smoking_fee_amount numeric(10,2),
  cleaning_fee_amount numeric(10,2),
  late_fee_amount numeric(10,2),
  late_fee_grace_minutes integer not null default 60,

  requires_insurance_upload boolean not null default true,
  requires_license_upload boolean not null default true,
  requires_selfie boolean not null default true,
  requires_agreement_signature boolean not null default true,

  pickup_method text not null default 'manual_handoff',
  return_method text not null default 'manual_return',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Deposit modes:

```txt
manual_record
stripe_charge
stripe_authorization_hold_later
waived
```

Pickup methods:

```txt
manual_handoff
lockbox
remote_unlock_later
delivery
counter_pickup
```

Return methods:

```txt
manual_return
lockbox_return
dropbox
pickup_by_operator
```

### 3. `renter_verifications`

```sql
create table if not exists renter_verifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,

  status text not null default 'not_started',
  denial_reason text,

  license_front_url text,
  license_back_url text,
  selfie_url text,
  insurance_card_url text,

  license_number_last4 text,
  license_state text,
  license_country text default 'US',
  license_expires_at date,
  date_of_birth date,

  has_personal_insurance boolean,
  insurance_provider text,
  insurance_policy_last4 text,
  insurance_expires_at date,

  reviewed_by_profile_id uuid,
  reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_renter_verifications_org_order
  on renter_verifications(organization_id, order_id);

create index if not exists idx_renter_verifications_customer
  on renter_verifications(organization_id, customer_id);

create index if not exists idx_renter_verifications_status
  on renter_verifications(organization_id, status);
```

Status values:

```txt
not_started
pending_uploads
submitted
under_review
approved
denied
expired
needs_resubmission
```

Security rules:

```txt
Do not store full license numbers unless required.
Do not expose verification file URLs unless authorized.
Uploads should use private storage if supported.
```

### 4. `rental_agreement_templates`

Operators need editable templates later.

```sql
create table if not exists rental_agreement_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  version text not null default 'v1',
  status text not null default 'draft',
  template_body text not null,
  variables jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Status values:

```txt
draft
active
archived
```

### 5. `rental_agreements`

```sql
create table if not exists rental_agreements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  template_id uuid references rental_agreement_templates(id) on delete set null,

  agreement_version text not null default 'v1',
  status text not null default 'draft',

  rendered_html text,
  pdf_url text,

  sent_at timestamptz,
  viewed_at timestamptz,
  signed_at timestamptz,

  signer_name text,
  signer_ip text,
  signer_user_agent text,
  signature_data_url text,

  voided_at timestamptz,
  void_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, order_id)
);

create index if not exists idx_rental_agreements_order
  on rental_agreements(organization_id, order_id);

create index if not exists idx_rental_agreements_status
  on rental_agreements(organization_id, status);
```

Status values:

```txt
draft
sent
viewed
signed
voided
expired
```

### 6. `rental_pickup_access`

```sql
create table if not exists rental_pickup_access (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  asset_id uuid references assets(id) on delete set null,

  access_type text not null default 'lockbox',
  access_code_encrypted text,
  access_code_last4 text,
  pickup_instructions text,
  return_instructions text,

  release_status text not null default 'held',
  release_reason text,
  released_at timestamptz,
  released_by_profile_id uuid,

  revoked_at timestamptz,
  revoked_by_profile_id uuid,
  revoke_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (organization_id, order_id)
);
```

Access types:

```txt
lockbox
manual_handoff
remote_unlock_later
delivery
counter_pickup
```

Release statuses:

```txt
held
ready
released
revoked
expired
```

Encryption rule:

```txt
If the repo has encryption helpers, use them.
If not, isolate lockbox code logic in one helper so encryption can be added later.
Never scatter access code reads/writes.
```

### 7. `rental_condition_photos`

```sql
create table if not exists rental_condition_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  asset_id uuid references assets(id) on delete set null,

  phase text not null,
  photo_url text not null,
  storage_path text,
  label text,
  notes text,

  captured_lat numeric,
  captured_lng numeric,
  captured_at timestamptz,
  uploaded_by_profile_id uuid,
  uploaded_by_customer boolean not null default false,

  created_at timestamptz not null default now()
);

create index if not exists idx_rental_condition_photos_order
  on rental_condition_photos(organization_id, order_id);

create index if not exists idx_rental_condition_photos_asset_phase
  on rental_condition_photos(organization_id, asset_id, phase);
```

Phases:

```txt
pre_pickup
pickup
during_rental
return
post_return
damage_review
```

Recommended labels:

```txt
front
rear
driver_side
passenger_side
interior_front
interior_rear
dashboard_odometer
fuel_level
wheel_tire
damage_closeup
other
```

### 8. `rental_charges`

```sql
create table if not exists rental_charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,

  charge_type text not null,
  status text not null default 'draft',
  amount numeric(10,2) not null default 0,
  description text,

  evidence_url text,
  evidence_storage_path text,

  approved_by_profile_id uuid,
  approved_at timestamptz,

  charged_payment_id uuid references payments(id) on delete set null,
  charged_at timestamptz,

  waived_by_profile_id uuid,
  waived_at timestamptz,
  waiver_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rental_charges_order
  on rental_charges(organization_id, order_id);

create index if not exists idx_rental_charges_status
  on rental_charges(organization_id, status);
```

Charge types:

```txt
late_fee
mileage_overage
fuel_fee
cleaning_fee
smoking_fee
toll
ticket
damage
extension
lost_key
admin_fee
other
```

Status values:

```txt
draft
pending_customer
approved
charged
paid
waived
disputed
voided
```

### 9. `rental_extensions`

```sql
create table if not exists rental_extensions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,

  current_end_at timestamptz,
  requested_end_at timestamptz not null,
  status text not null default 'pending',

  price_delta numeric(10,2) not null default 0,
  payment_status text not null default 'not_required',

  requested_by_customer boolean not null default true,
  reviewed_by_profile_id uuid,
  reviewed_at timestamptz,
  denial_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_rental_extensions_order
  on rental_extensions(organization_id, order_id);

create index if not exists idx_rental_extensions_status
  on rental_extensions(organization_id, status);
```

Status values:

```txt
pending
approved
denied
cancelled
paid
applied
```

Payment statuses:

```txt
not_required
pending
paid
failed
waived
```

### 10. `rental_customer_access_tokens`

Tokenized public renter access.

```sql
create table if not exists rental_customer_access_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,

  token_hash text not null,
  purpose text not null default 'rental_portal',
  status text not null default 'active',

  expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text,

  created_at timestamptz not null default now(),

  unique (token_hash)
);

create index if not exists idx_rental_access_tokens_order
  on rental_customer_access_tokens(organization_id, order_id);

create index if not exists idx_rental_access_tokens_status
  on rental_customer_access_tokens(status, expires_at);
```

Purposes:

```txt
rental_portal
verification_upload
agreement_signing
pickup_access
return_photos
```

Rules:

```txt
Never expose internal order IDs in public renter URLs.
Store only token hash, not raw token.
Tokens can expire or be revoked.
```

### 11. `rental_events`

If the repo already has a generic audit/event table, reuse it. If not, create car-rental-specific events.

```sql
create table if not exists rental_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  order_id uuid references orders(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  asset_id uuid references assets(id) on delete set null,

  event_type text not null,
  actor_type text not null default 'system',
  actor_profile_id uuid,
  actor_customer_id uuid,

  title text,
  description text,
  metadata jsonb not null default '{}'::jsonb,

  ip_address text,
  user_agent text,

  created_at timestamptz not null default now()
);

create index if not exists idx_rental_events_order
  on rental_events(organization_id, order_id, created_at desc);

create index if not exists idx_rental_events_type
  on rental_events(organization_id, event_type);
```

Event types:

```txt
reservation_created
verification_started
verification_uploaded
verification_submitted
verification_approved
verification_denied
agreement_created
agreement_sent
agreement_viewed
agreement_signed
payment_received
deposit_recorded
deposit_authorized
pickup_access_created
pickup_access_released
pickup_access_revoked
condition_photo_uploaded
rental_started
rental_return_due
rental_returned
return_review_started
charge_created
charge_approved
charge_charged
charge_paid
charge_waived
extension_requested
extension_approved
extension_denied
rental_completed
rental_cancelled
refund_recorded
```

Actor types:

```txt
system
operator
customer
admin
webhook
```

---

## Storage / File Security

Car rental introduces sensitive files.

### Storage categories

```txt
public vehicle photos
private license images
private selfies
private insurance cards
private signed agreements
private condition photos
private damage evidence
```

### Recommended buckets

If the repo already has a bucket convention, follow it. Otherwise use:

```txt
product-images             public or signed read
rental-verifications       private
rental-agreements          private
rental-condition-photos    private/signed access
rental-charge-evidence     private
```

### Storage rules

1. License/selfie/insurance uploads must be private.
2. Signed agreement PDFs must be private.
3. Vehicle listing photos can be public.
4. Condition photos should not be public by default.
5. Use signed URLs or authenticated proxy routes for private documents.
6. Public customer token access should only generate signed URLs for that order’s allowed files.

---

## RLS / Security Requirements

All car rental tables must be tenant-scoped by `organization_id`.

Minimum rules:

```txt
Operator dashboard users can access rows for their active organization.
Anonymous/public users cannot read sensitive tables directly.
Customer token routes use server-side lookup and never expose table-wide access.
Storage policies must not allow public access to verification documents.
```

Claude must adapt to the repo’s existing RLS helper functions.

A possible pattern if the repo uses org helper functions:

```sql
create policy "members can read own org vehicle profiles"
on vehicle_profiles
for select
using (
  organization_id in (select get_user_org_ids())
);
```

Do not invent a new RLS approach if the repo already has one.

---

## Car Rental Lifecycle State Machine

Create:

```txt
lib/car-rental/status.ts
```

Reservation statuses:

```txt
inquiry
quote_sent
awaiting_verification
verification_pending
verification_denied
awaiting_agreement
awaiting_payment
confirmed
ready_for_pickup
pickup_access_released
active
return_due
returned
under_review
completed
cancelled
refunded
```

Legal transitions:

```ts
const CAR_RENTAL_TRANSITIONS = {
  inquiry: ["quote_sent", "awaiting_verification", "cancelled"],
  quote_sent: ["awaiting_verification", "cancelled"],
  awaiting_verification: ["verification_pending", "cancelled"],
  verification_pending: ["awaiting_agreement", "verification_denied", "cancelled"],
  verification_denied: ["awaiting_verification", "cancelled"],
  awaiting_agreement: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["confirmed", "cancelled"],
  confirmed: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["pickup_access_released", "cancelled"],
  pickup_access_released: ["active", "cancelled"],
  active: ["return_due", "returned"],
  return_due: ["returned"],
  returned: ["under_review", "completed"],
  under_review: ["completed"],
  completed: [],
  cancelled: ["refunded"],
  refunded: [],
};
```

Helpers:

```ts
isCarRentalStatus(value)
canTransitionCarRentalStatus(from, to)
assertCarRentalStatusTransition(from, to)
labelCarRentalStatus(status)
```

Do not allow arbitrary status changes.

---

## Release Gate Architecture

Create:

```txt
lib/car-rental/release-gate.ts
```

Gate result:

```ts
export type RentalReleaseGateMissing =
  | "verification_approved"
  | "agreement_signed"
  | "payment_complete"
  | "deposit_authorized"
  | "pickup_window_open"
  | "vehicle_ready"
  | "pickup_access_configured";

export type RentalReleaseGateResult = {
  canRelease: boolean;
  missing: RentalReleaseGateMissing[];
  warnings: string[];
};
```

MVP required gates:

```txt
verification_approved
agreement_signed
payment_complete OR deposit_authorized
pickup_access_configured
```

Later gates:

```txt
pickup_window_open
vehicle_ready
pre_pickup_condition_photos_uploaded
```

The release action must call the server-side helper. UI display is not enough.

---

## Pricing Architecture

Create:

```txt
lib/car-rental/pricing.ts
```

Pricing inputs:

```ts
export type CarRentalPricingInput = {
  startAt: string;
  endAt: string;

  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;

  depositAmount?: number;

  mileageIncludedPerDay?: number;
  mileageOverageRate?: number;

  deliveryFee?: number;
  pickupFee?: number;

  protectionPlanFeePerDay?: number;
  discountAmount?: number;
  taxRate?: number;
};
```

Pricing output:

```ts
export type CarRentalPricingResult = {
  rentalDays: number;
  baseRentalAmount: number;
  weeklyDiscountApplied: boolean;
  monthlyDiscountApplied: boolean;
  protectionAmount: number;
  deliveryFee: number;
  pickupFee: number;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  estimatedTotal: number;
  dueNowAmount: number;
  depositAmount: number;
  mileageIncludedTotal: number | null;
};
```

Rules:

1. Count rental days consistently.
2. Do not mutate the existing generic pricing engine.
3. Car rental pricing should be an adapter.
4. Preserve existing party rental checkout behavior.
5. Do not calculate mileage overage until return unless explicitly estimated.

---

## Payment / Stripe Architecture

Car rental payment requirements:

```txt
upfront payment
security deposit
authorization hold
saved payment method later
incidentals
extensions
refunds
damage fees
tolls/tickets
```

### MVP acceptable strategy

```txt
Use existing Stripe Checkout for due-now amount.
Record deposit requirement in rental policy/charges.
Allow manual deposit record if holds are not implemented.
```

### Future strategy

```txt
Stripe PaymentIntent with capture later
SetupIntent to save card for incidentals
separate authorization hold for deposit
manual/admin review before post-rental charge
customer notification for charge
dispute evidence package
```

Do not write code that assumes:

```txt
one checkout session = full final rental settlement
```

Use `payments` and `rental_charges` in a way that can support later PaymentIntents.

---

## Customer Token Portal

Do not force renter accounts in MVP.

Create public token routes later:

```txt
/rentals/access/[token]
/rentals/access/[token]/verification
/rentals/access/[token]/agreement
/rentals/access/[token]/payment
/rentals/access/[token]/pickup
/rentals/access/[token]/return
```

Token helper later:

```txt
lib/car-rental/access-token.ts
```

Functions:

```ts
createRentalAccessToken(orderId, purpose)
hashRentalAccessToken(token)
verifyRentalAccessToken(token, purpose)
revokeRentalAccessToken(tokenId)
```

Rules:

```txt
raw token only shown once
hash stored in database
token scoped to one order/customer
token can expire
token can be revoked
server-side lookup only
```

---

## Admin / Operator Workflow

Car rental admin detail page needs these sections:

```txt
Reservation summary
Customer/renter
Vehicle/asset
Verification
Agreement
Payment/deposit
Pickup/access
Condition photos
Return review
Charges
Events/audit
```

Recommended routes:

```txt
app/dashboard/car-rentals/page.tsx
app/dashboard/car-rentals/[orderId]/page.tsx
app/dashboard/car-rentals/[orderId]/verification/page.tsx
app/dashboard/car-rentals/[orderId]/agreement/page.tsx
app/dashboard/car-rentals/[orderId]/pickup-access/page.tsx
app/dashboard/car-rentals/[orderId]/condition/page.tsx
app/dashboard/car-rentals/[orderId]/charges/page.tsx
```

Do not build these until schema/helpers are ready.

---

## Public Booking Flow

Future full flow:

```txt
Browse cars
→ Select car/date range
→ See estimated price/deposit/mileage
→ Enter renter info
→ Create reservation
→ Upload verification
→ Sign agreement
→ Pay/deposit
→ Admin approval
→ Pickup/access release
→ Rental active
→ Return photos
→ Review/charges
→ Complete
```

MVP can be simpler:

```txt
Browse/request
→ operator review
→ verification/sign/pay
```

But the architecture must not block the full flow later.

---

## Availability Architecture

Use generic `availability_blocks`.

Car rental block types:

```txt
rental_hold
confirmed_rental
maintenance
owner_block
cleaning_buffer
damage_review
admin_hold
delivery_buffer
return_buffer
```

Rules:

1. Availability checks asset-level conflicts when a specific vehicle is selected.
2. Availability checks product/class availability when product represents a vehicle class.
3. Reservation holds should expire if not paid/confirmed.
4. Maintenance blocks should prevent booking.
5. Return buffer should be configurable.

Create later:

```txt
lib/car-rental/availability.ts
```

---

## Condition / Inspection Architecture

Car rental evidence is not optional.

Photo phases:

```txt
pre_pickup
pickup
during_rental
return
post_return
damage_review
```

Potential inspection checklist sections:

```txt
exterior
interior
odometer
fuel_level
tires
glass
lights
warning_lights
smell/smoking
cleanliness
new_damage
```

Do not rely only on one generic `inspections.checklist_json` if it makes photo evidence difficult to query.

---

## Documents and Agreement Architecture

Document types:

```txt
rental_agreement
license_front
license_back
selfie
insurance_card
vehicle_registration
vehicle_insurance
condition_report
damage_invoice
refund_receipt
extension_agreement
```

Access levels:

```txt
public_listing
operator_only
customer_token_scoped
admin_only
```

Do not treat all documents as the same.

---

## Notification Boundary

Car rental will need notifications:

```txt
reservation received
verification needed
verification approved/denied
agreement ready
payment needed
pickup instructions released
return reminder
late return
charge added
rental completed
```

Do not hard-code notification sending across many actions.

If the repo has email trigger helpers, use them. If not, design toward:

```txt
notification_outbox
```

Potential table later:

```sql
notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  channel text not null,
  template_key text not null,
  recipient text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  send_after timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
```

Phase 1 does not need this table, but Claude should avoid patterns that make it hard to add.

---

## Legal / Compliance Guardrails

The app should provide configurable operator policy templates, not legal advice.

Policy areas:

```txt
renter eligibility
insurance/protection
deposit
mileage
fuel
late return
cleaning/smoking
tolls/tickets
damage
cancellation/refund
extensions
prohibited use
contactless pickup
```

Do not present app-generated agreements as universal legal documents. Provide template support with operator customization.

---

## Phase Plan

### Phase 0 — Recon and Repo Safety

Claude must inspect:

```txt
README.md
package.json
supabase/schema.sql
supabase/migrations
lib/checkout/actions.ts
lib/pricing
lib/availability
lib/documents
lib/orders
lib/payments
lib/routes/actions.ts
app/checkout
app/inventory
app/dashboard
middleware.ts
```

Confirm:

```txt
current table names
soft delete conventions
org-context helper
RLS helper style
storage bucket conventions
checkout flow
pricing flow
availability flow
Stripe/payment flow
document generation flow
dashboard route conventions
test/build scripts
```

Deliverable:

```txt
short summary
no code changes unless asked
list mismatches from this plan
```

### Phase 1 — Vertical Helper Foundation

Goal:

Prepare vertical/car-rental helpers with zero customer-visible change.

Add:

```txt
lib/verticals/config.ts
lib/car-rental/constants.ts
lib/car-rental/status.ts
lib/car-rental/pricing.ts
lib/car-rental/release-gate.ts
```

Do not add UI.

Do not add all schema tables yet.

Acceptance:

```txt
existing party/inflatable flow unchanged
helpers compile
status transitions tested if tests exist
pricing helper has simple unit tests if repo supports tests
release gate helper isolated
```

### Phase 2 — Schema Foundation

Add migrations for:

```txt
vehicle_profiles
vehicle_rental_policies
renter_verifications
rental_agreement_templates
rental_agreements
rental_pickup_access
rental_condition_photos
rental_charges
rental_extensions
rental_customer_access_tokens
rental_events
```

Only add `organization_verticals` if Phase 0 proves it is needed now.

Acceptance:

```txt
migrations apply cleanly
RLS matches existing style
private documents not publicly exposed
existing tables untouched
existing checkout/dashboard still work
```

### Phase 3 — Car Rental Admin Foundation

Build internal dashboard tools:

```txt
create vehicle asset + vehicle_profile
edit vehicle profile
set rental policy
set vehicle status
list car rental vehicles
```

No public checkout yet.

### Phase 4 — Reservation Adapter

Build server actions/helpers to create car rental reservations using generic orders.

Create:

```txt
order
order_item
availability_block
renter_verification
rental_agreement
rental_pickup_access
rental_event
```

Acceptance:

```txt
reservation exists in generic order system
release gate returns missing requirements
availability hold exists
party checkout not broken
```

### Phase 5 — Customer Token Portal Foundation

Build token verification and basic renter portal shell.

Routes:

```txt
/rentals/access/[token]
```

No sensitive uploads until storage rules are ready.

### Phase 6 — Verification Upload + Admin Review

Build:

```txt
license front/back upload
selfie upload
insurance card upload
admin approve/deny
verification events
release gate integration
```

### Phase 7 — Agreement Generation + E-Sign

Build:

```txt
agreement render
customer view/sign
signature metadata
PDF if existing tools support it
agreement events
release gate integration
```

### Phase 8 — Payment / Deposit Gate

Build:

```txt
payment status integration
manual deposit record
Stripe Checkout due-now flow
future PaymentIntent-compatible structure
release gate integration
```

### Phase 9 — Pickup Access Release

Build:

```txt
admin set access
release gate check
release/revoke
customer view only after release
pickup access events
```

### Phase 10 — Condition Photos + Return Review

Build:

```txt
pickup photos
return photos
admin review
damage review
complete rental
```

### Phase 11 — Charges / Fees / Extensions

Build:

```txt
post-rental charges
late fee
mileage overage
fuel/cleaning/smoking/toll/ticket/damage
extensions
payment recording
```

### Phase 12 — Public Car Rental UX

Build refined pages:

```txt
cars catalog
vehicle detail
date range picker
price estimate
reservation checkout
customer portal flow
```

### Phase 13 — Fleet Intelligence Integration Later

Borrow later from fleet-management:

```txt
maintenance reminders
registration/insurance expiration alerts
vehicle health
cost per vehicle
utilization reporting
telematics/GPS
```

---

## Suggested File Structure

```txt
lib/verticals/config.ts

lib/car-rental/constants.ts
lib/car-rental/status.ts
lib/car-rental/pricing.ts
lib/car-rental/release-gate.ts
lib/car-rental/events.ts
lib/car-rental/access-token.ts
lib/car-rental/availability.ts
lib/car-rental/verification.ts
lib/car-rental/agreement.ts
lib/car-rental/pickup-access.ts
lib/car-rental/condition-photos.ts
lib/car-rental/charges.ts
lib/car-rental/extensions.ts

app/dashboard/car-rentals/page.tsx
app/dashboard/car-rentals/[orderId]/page.tsx
app/dashboard/car-rentals/[orderId]/verification/page.tsx
app/dashboard/car-rentals/[orderId]/agreement/page.tsx
app/dashboard/car-rentals/[orderId]/pickup-access/page.tsx
app/dashboard/car-rentals/[orderId]/condition/page.tsx
app/dashboard/car-rentals/[orderId]/charges/page.tsx

app/rentals/access/[token]/page.tsx
app/rentals/access/[token]/verification/page.tsx
app/rentals/access/[token]/agreement/page.tsx
app/rentals/access/[token]/payment/page.tsx
app/rentals/access/[token]/pickup/page.tsx
app/rentals/access/[token]/return/page.tsx

components/car-rental/VehicleForm.tsx
components/car-rental/VehiclePolicyForm.tsx
components/car-rental/ReservationSummary.tsx
components/car-rental/VerificationReviewCard.tsx
components/car-rental/AgreementStatusCard.tsx
components/car-rental/ReleaseGateCard.tsx
components/car-rental/PickupAccessCard.tsx
components/car-rental/ConditionPhotoGrid.tsx
components/car-rental/RentalChargesTable.tsx
components/car-rental/RentalTimeline.tsx
```

Adapt to existing repo conventions.

---

## Testing / Validation

Run existing scripts from `package.json`.

Likely:

```bash
npm run lint
npm run build
npm run test
npm run test:smoke
```

If scripts differ, inspect `package.json`.

Manual regression tests:

```txt
existing homepage loads
inventory loads
checkout works for current vertical
dashboard loads
products still create/edit
orders still list/detail
payments still record
documents still generate
delivery/routes still work
demo mode still works if supported
```

Car-rental foundation tests:

```txt
vertical config returns car_rental config
status transition helper blocks illegal transitions
pricing helper calculates rental days and totals
release gate blocks missing verification/agreement/payment
no public car rental UI visible yet
```

---

## Claude Code Startup Prompt

Use this prompt with Claude Code.

```txt
You are working in the `kkoly10/rental-software` repo.

Read `CAR_RENTAL_EXPANSION_MASTER_PLAN_V2.md` first and treat it as the source of truth.

Goal:
Prepare the rental platform for a future car rental SaaS expansion without breaking the current inflatable/party rental product.

Important architecture rules:
- Do not create a separate car rental app.
- Do not fork the current product.
- Do not refactor the whole app.
- Preserve the generic rental core: products, assets, orders, order_items, availability_blocks, payments, documents, inspections, routes.
- Add car rental as a vertical adapter/module layer.
- Do not hard-code car rental labels into generic components.
- Do not build UI before vertical config and helper boundaries are stable.
- Preserve current checkout/dashboard behavior.
- Use existing Supabase, RLS, org-context, checkout, pricing, document, availability, storage, and payment patterns.
- Every sensitive renter document must be tenant-scoped and protected.
- Contactless pickup/access release must be server-gated by verification, agreement, and payment/deposit status.
- Avoid creating structures that would block Stripe authorization holds later.
- Use status transition helpers; do not allow arbitrary rental lifecycle changes later.
- Keep the build maintainable: small helpers, clear migrations, no giant components.

Start with Phase 0 and Phase 1 only:
1. Inspect README, package.json, schema/migrations, checkout, pricing, availability, documents, orders, payments, routes, dashboard, middleware, storage conventions, and RLS policies.
2. Confirm current table names and conventions.
3. Confirm whether `organizations.business_type` is sufficient for Phase 1 or whether `organization_verticals` should be deferred to Phase 2.
4. Confirm whether the repo already has audit/event logging and private storage patterns.
5. Create a short architecture summary before coding.
6. Add vertical/car-rental helper foundation only:
   - `lib/verticals/config.ts`
   - `lib/car-rental/constants.ts`
   - `lib/car-rental/status.ts`
   - `lib/car-rental/pricing.ts`
   - `lib/car-rental/release-gate.ts`
7. Add small tests for pure helpers if the repo test setup makes that simple.
8. Do not add car rental UI yet.
9. Do not add all car rental tables yet unless necessary for helper compilation.
10. Do not change current public checkout behavior.
11. Run typecheck/build/tests.
12. Report changed files, what was added, what was intentionally deferred, and schema decisions needed for Phase 2.

If existing schema differs from this handoff, stop and explain the mismatch before coding around it.
```

---

## First Branch and Commit

Recommended branch:

```bash
git checkout -b feature/car-rental-vertical-foundation
```

Recommended commit:

```bash
git commit -m "Add car rental vertical foundation"
```

---

## Final Standard

This plan is strong only if the foundation protects:

```txt
generic rental core
vertical configuration
tenant-scoped RLS
private renter documents
tokenized renter portal
release gate
payment/deposit future flexibility
status transition rules
event/audit history
condition evidence
post-rental charges
current party rental regression safety
```

If those are protected, the repo can support car rental without becoming a maintenance nightmare.
