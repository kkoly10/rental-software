# Rental Software Database Schema

This document is the v1 schema blueprint for an inflatable-first rental platform that can later expand into party rental and trailer rental workflows.

## Core design principles

- multi-tenant from day one
- shared order engine across verticals
- support both catalog items and serialized assets
- support date-based availability, delivery workflows, inspections, and maintenance
- keep public booking, operator dashboard, and crew workflows on one backend

## Main entities

### organizations
One business account per operator brand.

Key fields:
- id
- name
- slug
- business_type
- timezone
- default_currency
- created_at

### profiles
User identity profile tied to auth.

Key fields:
- id
- full_name
- email
- phone
- created_at

### organization_memberships
Maps users to organizations and roles.

Key fields:
- id
- organization_id
- profile_id
- role
- status
- created_at

Roles:
- owner
- admin
- dispatcher
- crew
- viewer

### service_areas
ZIP-based or radius-based service coverage.

Key fields:
- id
- organization_id
- label
- zip_code
- city
- state
- delivery_fee
- minimum_order_amount
- is_active

### customers
Public booking customer record.

Key fields:
- id
- organization_id
- first_name
- last_name
- email
- phone
- notes
- created_at

### customer_addresses
Saved delivery and billing addresses.

Key fields:
- id
- customer_id
- label
- line1
- line2
- city
- state
- postal_code
- is_default_delivery
- is_default_billing

### categories
Shared catalog categories.

Examples:
- bounce-houses
- water-slides
- obstacle-courses
- tents
- tables-chairs
- trailers
- add-ons

Key fields:
- id
- organization_id
- name
- slug
- vertical
- parent_category_id
- sort_order
- is_active

### products
Public catalog product definition.

Key fields:
- id
- organization_id
- category_id
- name
- slug
- short_description
- description
- rental_mode
- pricing_model
- base_price
- security_deposit_amount
- requires_serialized_asset
- requires_delivery
- is_active
- visibility

Rental modes:
- catalog_only
- serialized_asset
- package

Pricing models:
- flat_day
- flat_event
- hourly
- weekend
- custom_quote

### product_images
Public catalog images.

Key fields:
- id
- product_id
- image_url
- alt_text
- sort_order
- is_primary

### product_attributes
Flexible specs by product.

Examples:
- dimensions
- recommended_age
- power_required
- dry_or_wet
- hitch_type
- trailer_brake_type

Key fields:
- id
- product_id
- attribute_key
- attribute_value
- attribute_group

### assets
Serialized inventory units for products that need real asset tracking.

Use cases:
- individual inflatable units
- trailers
- generators

Key fields:
- id
- organization_id
- product_id
- asset_tag
- serial_number
- vin_or_identifier
- purchase_date
- condition_status
- operational_status
- location_label
- notes

Condition status examples:
- excellent
- good
- fair
- damaged

Operational status examples:
- ready
- maintenance
- retired
- unavailable

### availability_blocks
Blocks products or assets from booking.

Key fields:
- id
- organization_id
- product_id
- asset_id
- block_type
- starts_at
- ends_at
- reason
- source_order_id

Block types:
- booking
- maintenance
- manual_hold
- cleaning_buffer
- transit_buffer

### orders
Main booking record.

Key fields:
- id
- organization_id
- customer_id
- order_number
- order_status
- quote_status
- event_date
- event_start_time
- event_end_time
- delivery_address_id
- billing_address_id
- subtotal_amount
- delivery_fee_amount
- discount_amount
- tax_amount
- total_amount
- deposit_due_amount
- balance_due_amount
- source_channel
- notes
- created_at

Order statuses:
- inquiry
- quote_sent
- awaiting_deposit
- confirmed
- scheduled
- out_for_delivery
- delivered
- pickup_pending
- completed
- cancelled
- refunded

### order_items
Line items attached to the order.

Key fields:
- id
- order_id
- product_id
- asset_id
- line_type
- quantity
- unit_price
- line_total
- item_name_snapshot
- notes

Line types:
- rental
- add_on
- delivery
- labor
- fee
- discount

### payments
Payment records from deposit through completion.

Key fields:
- id
- order_id
- provider
- provider_payment_id
- payment_type
- payment_status
- amount
- paid_at
- failure_reason

Payment types:
- deposit
- balance
- refund
- fee

Payment statuses:
- pending
- paid
- failed
- refunded
- partially_refunded

### documents
Waivers, rental agreements, inspection documents.

Key fields:
- id
- organization_id
- order_id
- customer_id
- document_type
- document_status
- file_url
- signed_at
- expires_at

Document types:
- rental_agreement
- safety_waiver
- inspection_form
- invoice

### routes
Daily delivery route header.

Key fields:
- id
- organization_id
- route_date
- name
- assigned_vehicle
- assigned_driver_profile_id
- route_status

### route_stops
Stops within a delivery or pickup route.

Key fields:
- id
- route_id
- order_id
- stop_type
- stop_sequence
- scheduled_window_start
- scheduled_window_end
- stop_status
- proof_photo_url
- signature_name
- completed_at

Stop types:
- delivery
- pickup
- service

Stop statuses:
- assigned
- loaded
- en_route
- arrived
- setup_complete
- pickup_complete
- completed
- failed

### maintenance_records
Maintenance and repair logs.

Key fields:
- id
- organization_id
- asset_id
- maintenance_type
- status
- opened_at
- completed_at
- vendor_name
- cost_amount
- notes

### inspections
Pre-delivery, return, or trailer inspection workflow.

Key fields:
- id
- organization_id
- asset_id
- order_id
- inspection_type
- performed_by_profile_id
- inspection_status
- checklist_json
- damage_notes
- completed_at

### audit_logs
Optional but recommended activity tracking.

Key fields:
- id
- organization_id
- actor_profile_id
- entity_type
- entity_id
- action
- changes_json
- created_at

## Suggested relationships

- organizations 1:N organization_memberships
- organizations 1:N service_areas
- organizations 1:N categories
- organizations 1:N products
- organizations 1:N assets
- organizations 1:N orders
- customers 1:N customer_addresses
- orders 1:N order_items
- orders 1:N payments
- orders 1:N documents
- routes 1:N route_stops
- assets 1:N maintenance_records
- assets 1:N inspections

## Index priorities

Create indexes on:
- organizations.slug
- categories.slug with organization_id
- products.slug with organization_id
- assets.asset_tag
- orders.order_number
- orders.event_date
- orders.order_status
- availability_blocks.starts_at and ends_at
- route_stops.stop_status
- payments.payment_status

## Expansion notes

### Party rental expansion
This same schema supports:
- bundles and package products
- optional add-ons
- labor/setup charges
- tent and table inventory

### Trailer rental expansion
Additions can stay inside the same structure by using:
- products for trailer types
- assets for serialized trailers
- inspections for check-in/check-out
- product_attributes for hitch, brake, and capacity rules
- documents for trailer agreements and verification files
