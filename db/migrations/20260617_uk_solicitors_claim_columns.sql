-- UK solicitor pilot — Session 2
-- Additive, nullable owner/claim columns on uk_solicitors. Mirrors the accountant
-- supabase/uk/001 pattern. SAFE: purely additive on a fully-gated table (every row
-- is_published=false at apply time). Parallel claim flow — does NOT touch legal_listings.
-- Magic-link control verification grants a free "Verified" badge; NO payment this
-- session (GBP tiers deferred — TODO(UK-PRICING)). Idempotent.
--
-- NOTE vs accountant: the firm slug / claim key is the uuid PK `id`, NOT company_number
-- (uk_solicitors has 559 LSNI rows with company_number IS NULL). `id` is already the PK
-- (unique), so no extra unique index is created; the existing partial-unique on
-- company_number (uk_solicitors_company_number_uniq) stays as-is.

ALTER TABLE public.uk_solicitors
  ADD COLUMN IF NOT EXISTS owner_email      text,
  ADD COLUMN IF NOT EXISTS owner_name       text,
  ADD COLUMN IF NOT EXISTS owner_auth_token text,
  ADD COLUMN IF NOT EXISTS is_claimed       boolean DEFAULT false;

-- claimed_at already exists from the Phase 1 create migration.

-- Magic-link verification looks up by (id, owner_auth_token).
CREATE INDEX IF NOT EXISTS uk_solicitors_owner_auth_token_idx
  ON public.uk_solicitors (owner_auth_token)
  WHERE owner_auth_token IS NOT NULL;
