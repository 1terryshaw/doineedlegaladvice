-- migrate-leadsplus.sql — leads-plus-canary-v1 (2026-10-09). Delta for an EXISTING legal DB.
-- Additive only, idempotent. Nothing here changes what any page renders until the app code that
-- reads these columns ships AND a listing has leads_plus_enabled = true (canary gate, default false).
--
-- Leads Plus is stored on the listing as the existing 'reviews_plus' tier slug (R3: no new ranking
-- boost — tier_priority is generated from `tier` and is untouched; valid_tier CHECK is untouched).
-- Supabase default privileges make every NEW table/function anon-reachable, so each one below is
-- explicitly REVOKEd from anon/authenticated/public and granted to service_role only.
begin;

alter table public.legal_listings
  add column if not exists leads_plus_enabled boolean not null default false, -- canary gate (per listing)
  add column if not exists lead_notify_email2 text,          -- optional second notification address
  add column if not exists lead_whatsapp text,               -- WhatsApp number (E.164-ish digits); button only if set
  add column if not exists lead_page_mode text,              -- 'A' (no site: quote/call) | 'B' (has a site they like)
  add column if not exists lead_kit_draft jsonb,             -- owner content kit working copy (never public)
  add column if not exists lead_kit_published jsonb,         -- owner-APPROVED content (the only kit content a page renders)
  add column if not exists lead_kit_published_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'legal_listings_lead_page_mode_chk') then
    alter table public.legal_listings add constraint legal_listings_lead_page_mode_chk
      check (lead_page_mode is null or lead_page_mode in ('A','B'));
  end if;
end $$;

-- The kit draft is owner working state: never readable by the anon/authenticated roles.
revoke select (lead_kit_draft, lead_notify_email2) on public.legal_listings from anon, authenticated;

create table if not exists public.legal_leads (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references public.legal_listings(id) on delete cascade,
  created_at        timestamptz not null default now(),
  customer_name     text not null check (char_length(customer_name) between 1 and 120),
  customer_email    text check (customer_email is null or char_length(customer_email) <= 254),
  customer_phone    text check (customer_phone is null or char_length(customer_phone) <= 40),
  need              text not null check (char_length(need) between 1 and 300),
  details           text check (details is null or char_length(details) <= 4000),
  service           text check (service is null or char_length(service) <= 120),
  budget            text check (budget is null or char_length(budget) <= 40),
  timing            text check (timing is null or char_length(timing) <= 40),
  mode              text not null default 'contact' check (mode in ('contact','quote')),
  status            text not null default 'new' check (status in ('new','replied','closed')),
  is_test           boolean not null default false,
  notify_status     text not null default 'pending'
                    check (notify_status in ('pending','sent','failed','bounced','complained')),
  notify_message_id text,
  ip_hash           text,
  constraint legal_leads_contact_chk check (customer_email is not null or customer_phone is not null)
);
create index if not exists legal_leads_listing_created_idx on public.legal_leads (listing_id, created_at desc);
create index if not exists legal_leads_ip_created_idx on public.legal_leads (ip_hash, created_at desc);
create index if not exists legal_leads_created_idx on public.legal_leads (created_at);
alter table public.legal_leads enable row level security;
revoke all on public.legal_leads from public, anon, authenticated;
grant select, insert, update, delete on public.legal_leads to service_role;

-- Contact-button taps (Call / Email / Visit website / WhatsApp). Taps are NOT leads.
create table if not exists public.legal_lead_taps (
  listing_id uuid not null references public.legal_listings(id) on delete cascade,
  day        date not null default current_date,
  kind       text not null check (kind in ('call','email','website','whatsapp')),
  n          integer not null default 0,
  primary key (listing_id, day, kind)
);
alter table public.legal_lead_taps enable row level security;
revoke all on public.legal_lead_taps from public, anon, authenticated;
grant select, insert, update, delete on public.legal_lead_taps to service_role;

create or replace function public.legal_lead_tap_inc(p_listing uuid, p_kind text)
returns void language sql security invoker set search_path = public as $$
  insert into public.legal_lead_taps (listing_id, day, kind, n) values (p_listing, current_date, p_kind, 1)
  on conflict (listing_id, day, kind) do update set n = public.legal_lead_taps.n + 1;
$$;
revoke all on function public.legal_lead_tap_inc(uuid, text) from public, anon, authenticated;
grant execute on function public.legal_lead_tap_inc(uuid, text) to service_role;

-- R6: leads are kept 12 months, then deleted. CREATED, NOT SCHEDULED (see OPERATIONS.md).
create or replace function public.legal_leads_purge()
returns jsonb language plpgsql security invoker set search_path = public as $$
declare nl integer; nt integer;
begin
  delete from public.legal_leads where created_at < now() - interval '12 months';
  get diagnostics nl = row_count;
  delete from public.legal_lead_taps where day < (current_date - interval '12 months')::date;
  get diagnostics nt = row_count;
  return jsonb_build_object('leads_deleted', nl, 'tap_days_deleted', nt);
end $$;
revoke all on function public.legal_leads_purge() from public, anon, authenticated;
grant execute on function public.legal_leads_purge() to service_role;

commit;

-- ROLLBACK (manual; drops lead data — export first):
--   drop function if exists public.legal_leads_purge();
--   drop function if exists public.legal_lead_tap_inc(uuid, text);
--   drop table if exists public.legal_lead_taps;
--   drop table if exists public.legal_leads;
--   alter table public.legal_listings drop constraint if exists legal_listings_lead_page_mode_chk,
--     drop column if exists leads_plus_enabled, drop column if exists lead_notify_email2,
--     drop column if exists lead_whatsapp, drop column if exists lead_page_mode,
--     drop column if exists lead_kit_draft, drop column if exists lead_kit_published,
--     drop column if exists lead_kit_published_at;
