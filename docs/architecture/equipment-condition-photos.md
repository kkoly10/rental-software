# Equipment Condition Photos (Sprint 5.5)

## Why this exists

**Damage documentation wedge.** No rental SaaS competitor ships a polished before/after photo flow. Goodshuffle Pro has waiver management, InflatableOffice has damage-fee line items, neither surfaces a clean side-by-side comparison. For bouncy-castle ops (torn vinyl = #1 dispute source) and equipment rental more broadly, photographic evidence ends ~90% of damage disputes before they escalate.

Half is already built. The Sprint 1.5 migration `20260602_050000_crew_proof_rpcs.sql` ships `crew_attach_proof_photo` + `crew_attach_signature` for the delivery side. Sprint 5.5 mirrors them for pickup + adds the operator + customer-portal comparison UI.

## Design philosophy: noob-first, not enterprise-first

Big companies (Hertz, Turo, Sunbelt Rentals, U-Haul, construction-equipment dealers) handle this with:
- Structured photo "slots" (front / left / right / back / interior)
- Mandatory walkthroughs that block stop-completion
- EXIF / location / hash evidence chains
- Damage codes with pricing tables
- Per-item granularity
- Slider visual diff tools

Korent's target buyer is a Saturday-morning bouncy-castle operator with three more deliveries to do. A 6-photo-slot protocol gets skipped or produces garbage shots aimed at the sky. The strategic value is having *something* on file — not forensic-grade evidence.

**v1 ships:**
- One photo, two moments (delivery + pickup)
- Optional but encouraged; never blocking
- **Visual matching nudge**: when the crew opens a pickup stop and a delivery photo exists for that order, the upload form renders the delivery photo as a thumbnail with "Match this angle." Same outcome as structured slots, zero protocol burden.
- Per-stop granularity (per-item deferred until 3+ operators ask)
- Customer-portal-visible from day 1 — strategic framing as "we documented your delivery" rather than "we collected evidence against you"
- No damage code library, no auto-charge workflow, no EXIF chain

## Data model

```
                    delivery side        pickup side
                    (Sprint 1.5)          (Sprint 5.5)
                    ─────────────         ───────────
route_stops
  proof_photo_url     ✓                    —
  signature_name      ✓                    —
  pickup_photo_url    —                    ✓
  pickup_signature_name —                  ✓
```

Two columns per side: photo URL + customer signature name. Both nullable. NULL = "crew skipped capture for this side." All four columns can coexist on a single route_stops row when the order has both a delivery and pickup stop on the same physical row (rare in practice — usually they're separate stops).

**Storage**: photos land in the existing `uploads` Supabase Storage bucket under prefixes `proof-photos/{orgId}/` and `pickup-photos/{orgId}/`. The storage-sweep cron (`/api/cron/storage-sweep`) was extended in Sprint 5.5 to clean orphaned pickup photos the same way it cleans orphaned proof photos.

## Atomic RPCs

`crew_attach_pickup_photo` and `crew_attach_pickup_signature` mirror their delivery siblings exactly:
- Caller authorization (`owner` / `admin` / `dispatcher` / `crew` only)
- Crew-only assignment check (`routes.assigned_driver_profile_id = caller`)
- `FOR UPDATE` row lock on the parent route so a concurrent dispatcher reassignment can't let an unassigned crew member's photo land on the wrong route
- Single-transaction UPDATE

Same TOCTOU-closing pattern as `crew_attach_proof_photo` from Sprint 1.5.

## Flow

```
Crew opens /crew/today
  │
  ├─ Delivery stop in en_route+ status
  │    └─ ProofPhotoUpload component (existing, unchanged)
  │
  └─ Pickup stop in en_route+ status
       └─ PickupPhotoUpload component (new)
            │
            ├─ If matching delivery photo exists:
            │    render it as a "match this angle" thumbnail above
            │    the file input
            │
            ├─ File input with capture="environment" (rear camera)
            ├─ Optional client-side preview
            ├─ Submit → uploadPickupPhoto action
            └─ Action: type-sniff bytes → upload to bucket →
               atomic RPC to persist the URL
```

Matching is resolved at load time in `lib/data/route-detail.ts`: for any pickup-type stop on the current route, look up the same order's delivery stop (which may live on a different route) and surface its `proof_photo_url` as `matchingDeliveryPhotoUrl`.

## Operator view

`/dashboard/orders/[id]` renders the `EquipmentConditionCard` component when any of the order's stops have at least one photo or signature on file. The card:
- One row per route stop tied to the order
- Two columns per row: Delivery / Pickup
- Each column shows the photo (clickable, opens new tab full-res) or a placeholder ("Crew hasn't captured X yet")
- Signature surface below each photo when present (operator-facing only)

## Customer portal

`/order-status` (the portal lookup) passes `conditionRows` through `PortalOrder` to the `OrderLookupForm` client component. The same `EquipmentConditionCard` renders, but with `customerFacing={true}` so:
- Placeholders read "No X photo on file yet" instead of "Crew hasn't captured"
- Signature name is not shown (operator's internal record only)
- Card heading reads "Photos from your delivery and pickup" + helper copy frames it as transparency, not surveillance

## Files

| File | Purpose |
|---|---|
| `supabase/migrations/20260604_010000_equipment_condition_photos.sql` | Schema columns + 2 RPCs |
| `lib/crew/actions.ts` (modified) | `uploadPickupPhoto` + `savePickupSignature` server actions |
| `components/crew/pickup-photo-upload.tsx` | Crew workspace UI with visual matching nudge |
| `lib/data/route-detail.ts` (modified) | Resolves matchingDeliveryPhotoUrl for pickup stops + threads new columns |
| `app/crew/today/page.tsx` (modified) | Switches between ProofPhotoUpload / PickupPhotoUpload by stop type |
| `lib/data/equipment-condition.ts` | ConditionRow fetcher (org-context + portal-token variants) |
| `components/orders/equipment-condition-card.tsx` | Operator + customer-portal side-by-side comparison card |
| `app/dashboard/orders/[id]/page.tsx` (modified) | Mounts the card on the operator order detail page |
| `lib/portal/lookup.ts` (modified) | Attaches conditionRows to PortalOrder result |
| `components/portal/order-lookup-form.tsx` (modified) | Mounts the card on the customer portal |
| `app/api/cron/storage-sweep/route.ts` (modified) | Extends orphan-photo cleanup to include pickup_photo_url |
| `tests/smoke/equipment-condition.spec.ts` | HTTP smoke for the 4 surfaces |

## Deferred to Sprint 5.7+

Triggered when 3+ operators request, when disputes show pattern, or when sales conversations stall on a specific gap:

- **Per-item photo granularity** — one photo per line item, not per stop. Most relevant for high-value rentals (generators, AV equipment).
- **Damage code library + auto-charge workflow** — structured "tear / stain / missing part" vocabulary + pricing tables → auto-create a `payment` row in `damage_fee` status the operator confirms.
- **Photo annotation / markup tools** — circle the dent, type a label.
- **Slider visual diff** — Turo-style overlay where the operator drags a slider to see before/after at the same scale.
- **EXIF + hash chain** — evidence-grade timestamp, location, and integrity guarantees. Overkill for SMB rental until a customer specifically asks during a dispute.
- **Mandatory capture** — raise the bar later once operators are trained. v1 is "encouraged but skippable" because forcing it on noobs day-1 = abandonment.

## Strategic value

Three benefits in one feature:

1. **Differentiation**: no competitor ships this in a polished form.
2. **Dispute reduction**: photos visible to the customer reduce damage-charge arguments before they escalate to chargebacks.
3. **Trust signal**: framing as "we document your delivery so there's a clear record for both of us" turns a liability tool into a customer-friendly feature.

Goodshuffle Pro's waiver feature is text-based — operators write a generic "you're responsible for damage" clause and customers sign it. Korent shows specific photos of specific equipment with specific signatures. Different magnitude of evidence.
