-- =============================================================================
-- Per-vertical migration template — adds 8 SEO columns to <vertical>_listings.
-- =============================================================================
-- (a) WHAT: Adds 8 nullable columns backing the canonical OwnerEditForm v1
--     (hours, services, service area, GBP URL, year established, 3 socials).
-- (b) SCOPE: PER-VERTICAL. Stamper copies this file to each repo as
--       supabase/migrations/20260505_<vertical>_listings_extras.sql
--     and substitutes <vertical>_listings → the actual table name. (Note:
--     the table name is NOT always <repo-name>_listings — webdesigner uses
--     `webdesign_listings`. Use `verticalConfig.tablePrefix` as truth.)
-- (c) IDEMPOTENCY: Safe to re-run. ADD COLUMN IF NOT EXISTS, all nullable.
-- =============================================================================

ALTER TABLE fla_listings
  ADD COLUMN IF NOT EXISTS hours_json jsonb,
  ADD COLUMN IF NOT EXISTS services text[],
  ADD COLUMN IF NOT EXISTS service_area text[],
  ADD COLUMN IF NOT EXISTS gbp_url text,
  ADD COLUMN IF NOT EXISTS year_established int,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_facebook text,
  ADD COLUMN IF NOT EXISTS social_linkedin text;
