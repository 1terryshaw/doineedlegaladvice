-- migrate-leadsplus-p6.sql — leads-plus-canary-v1 P6 (2026-10-09). Additive, idempotent.
-- Leads Plus owners self-edit any time (P2 kit, owner approval = publish gate): NO change-batch queue for them.
-- They get the monthly nudge + up to 3 AI suggestions only, behind this per-listing flag (OFF for everyone).
alter table public.legal_listings
  add column if not exists lead_monthly_kit_enabled boolean not null default false;
-- Column grants: anon/authenticated have none on this column (table uses column-level grants); nothing to revoke.
-- ROLLBACK: alter table public.legal_listings drop column if exists lead_monthly_kit_enabled;
