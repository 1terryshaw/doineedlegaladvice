-- FreeLawyerAdvice.ca — Supabase table setup
-- Run this in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/msqiynbhoeruqctaesqk/sql/new

-- ── LISTINGS TABLE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fla_listings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Core identity
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  business_name text,

  -- Content
  description text,
  short_description text,

  -- Contact
  phone text,
  email text,
  website text,

  -- Location
  city text,
  province_state text,
  province text,
  country text DEFAULT 'CA',
  region_slug text,
  region text,

  -- Lawyer-specific
  listing_type text,          -- 'lawyer' (base)
  type text,                   -- practice area slug, e.g. 'family-lawyer'
  practice_area text,          -- same as type, alternate column name

  -- Ownership / Claim
  owner_auth_token text,
  owner_email text,
  owner_name text,
  claimed boolean DEFAULT false,
  is_claimed boolean DEFAULT false,
  claimed_at timestamptz,
  claim_verified boolean DEFAULT false,
  claimed_by text,

  -- Billing / Stripe
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  subscription_tier text,
  tier text DEFAULT 'seed',
  tier_activated_at timestamptz,
  tier_priority integer DEFAULT 1,
  featured boolean DEFAULT false,
  payment_error_review boolean DEFAULT false,

  -- Google Places
  google_place_id text UNIQUE,
  google_rating numeric,
  google_review_count integer DEFAULT 0,
  photo_urls text[],

  -- Outreach
  outreach_email1_at timestamptz,
  outreach_email2_at timestamptz,
  outreach_email3_at timestamptz,
  outreach_email4_at timestamptz,
  outreach_bounced boolean,
  outreach_unsubscribed boolean,
  outreach_unsub_token text,
  outreach_email1_variant text,

  -- Email harvest
  email_scraped_at timestamptz,
  email_harvest_attempted boolean DEFAULT false,
  email_harvested_at timestamptz,

  -- Enrichment
  description_generated_at timestamptz,
  now_hiring boolean DEFAULT false,

  -- SiteForge
  siteforge_preview_url text,
  siteforge_generation_id text,
  siteforge_url text,
  siteforge_status text,
  custom_domain text,

  -- Referral
  referral_code text,
  referred_by_code text,
  free_month_3_unlocked boolean DEFAULT false,
  referrer_credits_earned integer DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fla_city         ON fla_listings(city);
CREATE INDEX IF NOT EXISTS idx_fla_tier         ON fla_listings(tier);
CREATE INDEX IF NOT EXISTS idx_fla_claimed      ON fla_listings(claimed);
CREATE INDEX IF NOT EXISTS idx_fla_google_place ON fla_listings(google_place_id);
CREATE INDEX IF NOT EXISTS idx_fla_region_slug  ON fla_listings(region_slug);
CREATE INDEX IF NOT EXISTS idx_fla_listing_type ON fla_listings(listing_type);
CREATE INDEX IF NOT EXISTS idx_fla_type         ON fla_listings(type);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
ALTER TABLE fla_listings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON fla_listings;
CREATE POLICY "Public read access" ON fla_listings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role full access" ON fla_listings;
CREATE POLICY "Service role full access" ON fla_listings FOR ALL USING (auth.role() = 'service_role');

-- ── INQUIRIES TABLE ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fla_inquiries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid REFERENCES fla_listings(id),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fla_inquiries_listing ON fla_inquiries(listing_id);

ALTER TABLE fla_inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access" ON fla_inquiries;
CREATE POLICY "Public read access" ON fla_inquiries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role full access" ON fla_inquiries;
CREATE POLICY "Service role full access" ON fla_inquiries FOR ALL USING (auth.role() = 'service_role');
