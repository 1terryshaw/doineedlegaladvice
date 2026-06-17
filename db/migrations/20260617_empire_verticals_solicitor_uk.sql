-- Insert the solicitor_uk vertical row. Mirrors the accountant_uk row shape.
-- Apply with a freshly generated per-row secret (NOT reused from another vertical):
--   HMAC=$(openssl rand -base64 32)
--   psql "$DATABASE_URL" -v hmac="'$HMAC'" -f <this file>
-- The :hmac substitution keeps the secret value out of the committed SQL.

BEGIN;

INSERT INTO public.empire_verticals (
  vertical_slug,
  display_name,
  status,
  listings_table,
  primary_domain,
  hmac_secret,
  resend_from,
  name_col,
  siteforge_enabled,
  notes
)
VALUES (
  'solicitor_uk',
  'UK Solicitors',
  'active',
  'uk_solicitors',
  'doineedlegaladvice.com',
  :hmac,
  'auth@smartwebsitemanagement.ca',
  'business_name',
  false,
  'UK solicitor pilot (/uk/ subfolder on doineedlegaladvice.com). Source uk_solicitors (17,140 rows, Phase 1 working-full). SEO core + free Verified claim, three-jurisdiction regulator UX (SRA/LSS/LSNI). GBP paid tiers deferred — TODO(UK-PRICING).'
)
ON CONFLICT (vertical_slug) DO NOTHING;

COMMIT;
