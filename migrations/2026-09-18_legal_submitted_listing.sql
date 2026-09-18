-- ════════════════════════════════════════════════════════════════════════════════════════
-- newbiz-submissions-dinla-lane-build-v1 · spec §1.2 · TDL #1243 (addendum 5)
--
-- APPLY AS `postgres` OVER `DATABASE_URL` (Supavisor session pooler, port 5432).
-- 🔴 NEVER FROM THE SUPABASE DASHBOARD SQL EDITOR. The editor runs as `supabase_admin`,
-- whose default ACL on this project grants `anon` and `authenticated` ALL PRIVILEGES on every
-- new table in `public` (measured — see the tail's note). The lockdown tail below makes that
-- safe either way; the operational rule removes the need to rely on it.
--
-- STRICTLY ADDITIVE: no existing table, column, constraint, index or row is touched.
-- ════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════════════
-- legal_submitted_listing — THE SELF-SUBMITTED LANE. NOT A DIRECTORY LISTING.
--
-- ── THE GUARANTEE IS THE ABSENCE, NOT A COMMENT ─────────────────────────────────────────
-- A lane row can never acquire licensed-attorney status because there is NOWHERE ON IT to
-- put authority, credential or licence provenance. Deliberately absent, permanently:
--
--   license_number / license_state / license_status  -- there is no bar of record
--   bar_admission / year_admitted / years_practicing -- we verify no admission
--   firm_name                                        -- a firm identity we did not check
--   source / source_profile_url                      -- there is no source; the submitter is
--                                                    -- not an authority citing itself
--   deserve_reason / deserved_at / deserve_candidate -- a de-serve verdict is ABOUT A SOURCE
--   tier / tier_priority / featured / subscription_* -- the badge ladder is OFF LIMITS
--                                                    -- (Terry 2026-07-14) and is honoured
--                                                    -- here BY CONSTRUCTION, not by default
--   google_place_id / gbp_* / google_rating /        -- zero_google_places; and a rating we
--     google_review_count                            -- did not obtain is not a rating
--   claimed / claimed_by / owner_auth_token          -- the claim funnel's vocabulary. The
--                                                    -- lane mints NO claim credential.
--   possible_duplicate_of / name_norm / phone_norm   -- matcher columns. The lane is not in
--     / domain_norm / addr_norm                      -- match_claim_allowed_tables and never
--                                                    -- will be (legal_listings isn't either).
--   region_slug / city_slug / province_state         -- the DIRECTORY's hub keys. A lane row
--                                                    -- appears on no hub.
--
-- NOTHING JOINS THIS TABLE TO the directory's listings table. No FK in either direction, and
-- PS-L4 proves at the statement level that no SQL text anywhere in the repo mentions both.
-- ════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS legal_submitted_listing (
  submission_id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- THE SITE. Value-matches nothing; no FK. Exists so a preview/E2E row can never be a
  -- production row, and so a second US legal site could share the table later.
  site                     text        NOT NULL DEFAULT 'doineedlegaladvice',

  -- ── what the submitter typed. Every value here is OWNER_SUPPLIED by construction. ──
  business_name            text        NOT NULL,
  contact_name             text,
  address_line             text,
  city                     text        NOT NULL,
  region_state             text        NOT NULL,        -- 2-letter US state/DC code
  postal_code              text,
  country                  text        NOT NULL DEFAULT 'US',
  phone                    text,
  website                  text,
  public_email             text,                        -- optional, rendered on the page
  description              text,

  -- ── the submitter and the proof-of-control chain ──
  submitted_by_email       text        NOT NULL,        -- normalised; NEVER rendered
  submitted_at             timestamptz NOT NULL DEFAULT now(),
  submitted_ip             inet,
  submitted_user_agent     text,

  -- ── the one-time verify credential. SHA-256 ONLY.
  -- The directory's listings table stores its magic-link token in PLAINTEXT. That is the
  -- fleet's shape and it is deliberately not copied: a SELECT on this table must not hand
  -- the reader a live credential.
  verify_token_sha256      text,
  verify_token_expires_at  timestamptz,
  verify_failed_attempts   integer     NOT NULL DEFAULT 0,

  -- ── the lane's OWN owner session. Not the directory's cookie, not its token column.
  owner_session_sha256     text,
  owner_csrf_sha256        text,
  owner_session_expires_at timestamptz,
  owner_session_revoked_at timestamptz,

  -- ── lifecycle
  submission_status        text        NOT NULL DEFAULT 'pending_verification',
  verified_at              timestamptz,

  -- 🔴 is_published DEFAULT **false**. The directory table's DEFAULT is `true`, and that
  -- default is the single worst footgun in the arc (an INSERT that omits the column
  -- publishes a person instantly). Here an omitted column publishes NOTHING. The CHECK below
  -- makes publication structurally impossible before a mailbox is proven — a constraint, not
  -- a convention.
  is_published             boolean     NOT NULL DEFAULT false,
  published_at             timestamptz,
  withdrawn_at             timestamptz,
  removed_reason           text,

  -- ── what the gates decided, recorded for audit
  finder_resolution        text        NOT NULL DEFAULT 'NO_MATCH',
  region_resolution        text,                        -- 'KNOWN' | 'UNKNOWN'
  bot_check                text,                        -- 'human' | 'unchecked' | 'bypass:<why>'

  slug                     text        NOT NULL,
  updated_at               timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lsl_status_check CHECK
    (submission_status IN ('pending_verification','verified','withdrawn','removed')),
  CONSTRAINT lsl_region_resolution_check CHECK
    (region_resolution IS NULL OR region_resolution IN ('KNOWN','UNKNOWN')),
  -- A MATCH NEVER BECOMES A ROW. The only value a stored row may hold is NO_MATCH.
  CONSTRAINT lsl_finder_resolution_check CHECK (finder_resolution = 'NO_MATCH'),
  -- US-ONLY, at the storage layer. DINLA is hard US-only (region-scope.ts
  -- DIRECTORY_COUNTRIES=['US']); freelawyeradvice owns CA. The directory table's country
  -- DEFAULT is 'CA' — this table cannot make that mistake because 'US' is both the default
  -- AND the only legal value.
  CONSTRAINT lsl_country_us_only CHECK (country = 'US'),
  CONSTRAINT lsl_region_shape CHECK (region_state ~ '^[A-Z]{2}$'),
  CONSTRAINT lsl_publish_requires_verified CHECK
    (is_published = false OR submission_status = 'verified'),
  CONSTRAINT lsl_verified_has_timestamp CHECK
    (submission_status <> 'verified' OR verified_at IS NOT NULL),
  CONSTRAINT lsl_published_has_timestamp CHECK
    (is_published = false OR published_at IS NOT NULL),
  CONSTRAINT lsl_terminal_is_unpublished CHECK
    (submission_status NOT IN ('withdrawn','removed') OR is_published = false),
  CONSTRAINT lsl_name_nonempty  CHECK (btrim(business_name) <> ''),
  CONSTRAINT lsl_slug_nonempty  CHECK (btrim(slug) <> ''),
  CONSTRAINT lsl_email_nonempty CHECK (btrim(submitted_by_email) <> ''),
  CONSTRAINT lsl_attempts_sane  CHECK (verify_failed_attempts >= 0),
  CONSTRAINT lsl_verify_expiry_future CHECK
    (verify_token_expires_at IS NULL OR verify_token_expires_at > submitted_at),
  CONSTRAINT lsl_session_expiry_future CHECK
    (owner_session_expires_at IS NULL OR owner_session_expires_at > submitted_at)
);

-- the public URL is (site, slug)
CREATE UNIQUE INDEX IF NOT EXISTS lsl_slug_unique_idx ON legal_submitted_listing (site, slug);
-- a live credential is globally unique; NULL after consumption → PARTIAL
CREATE UNIQUE INDEX IF NOT EXISTS lsl_verify_token_idx
  ON legal_submitted_listing (verify_token_sha256) WHERE verify_token_sha256 IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lsl_session_idx
  ON legal_submitted_listing (owner_session_sha256) WHERE owner_session_sha256 IS NOT NULL;
-- the rate limiter's index: BOTH sort columns, in the predicate's own order.
CREATE INDEX IF NOT EXISTS lsl_ip_window_idx
  ON legal_submitted_listing (submitted_ip, submitted_at DESC) WHERE submitted_ip IS NOT NULL;
-- the render path
CREATE INDEX IF NOT EXISTS lsl_published_idx
  ON legal_submitted_listing (site, is_published, submitted_at DESC);

COMMENT ON TABLE legal_submitted_listing IS
  'SELF-SUBMITTED LANE. NOT a directory listing: no licence, no bar admission, no source, no tier, no badge, no deserve_reason, no matcher columns. Never joined to the directory listings table.';

-- ════════════════════════════════════════════════════════════════════════════════════════
-- legal_submitted_listing_history — append-only audit.
-- ════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS legal_submitted_listing_history (
  id             bigserial   PRIMARY KEY,
  submission_id  uuid        NOT NULL REFERENCES legal_submitted_listing(submission_id),
  at             timestamptz NOT NULL DEFAULT now(),
  actor          text        NOT NULL,   -- 'submitter'|'verify'|'owner'|'operator:<who>'|'system'
  action         text        NOT NULL,   -- 'created'|'verified'|'published'|'edited'|'withdrawn'|'removed'|'refused'
  from_status    text,
  to_status      text,
  from_published boolean,
  to_published   boolean,
  detail         text        NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS lsl_history_idx
  ON legal_submitted_listing_history (submission_id, at DESC);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- legal_submitted_email_delivery — audit of THAT a message was attempted. No body, no token.
-- (The directory plane has no app_email_delivery analogue; `legal_inquiries` is a LEAD table
-- with its own semantics and is not borrowed.)
-- ════════════════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS legal_submitted_email_delivery (
  id              bigserial   PRIMARY KEY,
  site            text        NOT NULL,
  submission_id   uuid        NOT NULL,
  recipient       text        NOT NULL,
  transport       text        NOT NULL,
  purpose         text        NOT NULL,   -- 'submission_verification'|'submission_live'|'submission_withdrawn'
  accepted        boolean     NOT NULL,
  provider_status text        NOT NULL DEFAULT '',
  attempted_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lsl_email_delivery_idx
  ON legal_submitted_email_delivery (submission_id, attempted_at DESC);

-- ════════════════════════════════════════════════════════════════════════════════════════
-- The failed-verify counter. PostgREST cannot increment a column without a function, and a
-- read-then-write would be two round trips on a REFUSAL path. Lane-owned, lane-table-only,
-- and deliberately NOT SECURITY DEFINER: it runs with the caller's rights like everything
-- else the lane touches.
-- ════════════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION legal_lane_bump_verify_failure(p_digest text)
RETURNS void
LANGUAGE sql
VOLATILE
AS $$
  UPDATE legal_submitted_listing
     SET verify_failed_attempts = verify_failed_attempts + 1
   WHERE verify_token_sha256 = p_digest;
$$;
REVOKE ALL ON FUNCTION legal_lane_bump_verify_failure(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION legal_lane_bump_verify_failure(text) TO service_role;

-- ════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 THE UNCONDITIONAL LOCKDOWN TAIL. A no-op in the good case, the entire safety property
-- in the bad one.
--
-- MEASURED ON THIS DATABASE:
--   select defaclrole::regrole, defaclnamespace::regnamespace, defaclacl from pg_default_acl
--     where defaclobjtype='r' and defaclacl::text like '%anon=arwdDxtm%';
--   → supabase_admin | public | {postgres=…, anon=arwdDxtm/…, authenticated=arwdDxtm/…, …}
--
-- Every new table created in `public` by `supabase_admin` is born with ALL privileges granted
-- to `anon` and `authenticated` — INSERT included. A lane table created without this tail is
-- an anonymous public write endpoint on a legal-advice domain.
-- ════════════════════════════════════════════════════════════════════════════════════════
ALTER TABLE legal_submitted_listing          ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_submitted_listing_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_submitted_email_delivery   ENABLE ROW LEVEL SECURITY;
-- ZERO policies, deliberately. RLS on + no policy = no anon/authenticated access even if a
-- grant survives. NOT FORCE, so the owning role is unaffected.
REVOKE ALL PRIVILEGES ON TABLE legal_submitted_listing         FROM anon, authenticated, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE legal_submitted_listing_history FROM anon, authenticated, PUBLIC;
REVOKE ALL PRIVILEGES ON TABLE legal_submitted_email_delivery  FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE legal_submitted_listing         TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE legal_submitted_listing_history TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE legal_submitted_email_delivery  TO service_role;
REVOKE ALL PRIVILEGES ON SEQUENCE legal_submitted_listing_history_id_seq FROM anon, authenticated, PUBLIC;
REVOKE ALL PRIVILEGES ON SEQUENCE legal_submitted_email_delivery_id_seq  FROM anon, authenticated, PUBLIC;
GRANT USAGE, SELECT ON SEQUENCE legal_submitted_listing_history_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE legal_submitted_email_delivery_id_seq  TO service_role;

COMMIT;
