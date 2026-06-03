-- Sprint 4 — WhatsApp Business via Twilio
--
-- None of Goodshuffle Pro / Booqable / InflatableOffice ship native
-- WhatsApp. Sprint 4 makes Korent the only rental SaaS with native
-- WhatsApp Business notifications — critical for US Hispanic markets
-- and the Mexico expansion (where WhatsApp is the default consumer
-- channel, not SMS).
--
-- Twilio acts as a WhatsApp Business Solution Provider (BSP). The
-- same Messages API + auth handles both SMS and WhatsApp; the only
-- send-time difference is the `whatsapp:` prefix on phone numbers
-- and ContentSid-based templates for proactive (out-of-24h) messages.
--
-- Org-level settings (whatsapp_enabled + whatsapp_sender_id) let the
-- operator pick when to use WhatsApp. Customer-level opt-in
-- (whatsapp_opted_in) gives the customer the final say so we don't
-- spam someone who only wanted SMS.

alter table customers
  add column if not exists whatsapp_opted_in boolean not null default false,
  add column if not exists whatsapp_number text;

comment on column customers.whatsapp_opted_in is
  'TCPA-style opt-in for WhatsApp messaging. Independent of sms_opt_in because the customer may want one channel but not the other. Defaults to false; surfaced as a toggle on the customer detail page.';
comment on column customers.whatsapp_number is
  'WhatsApp-specific phone number when it differs from the primary phone (rare — most customers WhatsApp the same number they receive SMS on). NULL means "fall back to customers.phone".';

alter table organizations
  add column if not exists whatsapp_enabled boolean not null default false,
  add column if not exists whatsapp_sender_id text;

comment on column organizations.whatsapp_enabled is
  'Org-level kill switch for the WhatsApp channel. When false, all customer notifications fall back to SMS regardless of customer opt-in. Defaults to false until the operator has completed the Meta Business sender approval.';
comment on column organizations.whatsapp_sender_id is
  'The Twilio WhatsApp sender (e.g., "whatsapp:+14155551234" for sandbox, or the production E.164 once approved). Each org maps to a single sender for the MVP; multi-sender routing is a future enhancement.';
