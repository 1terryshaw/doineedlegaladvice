-- ════════════════════════════════════════════════════════════════════════════════════════
-- THE HELD-AWARE FINDER · spec §2.2 · newbiz-submissions-dinla-lane-build-v1
--
-- Apply as `postgres` over DATABASE_URL (session pooler, 5432). Additive: creates one
-- function. No table, column, row, trigger or constraint is touched by this file.
--
-- 🔴 THIS FILE NAMES `legal_listings` AND NOTHING ELSE. It does not mention the lane's own
-- tables, and the lane's store does not mention this one's. That is PS-L4 holding at the
-- statement level: a lane row and a roster row can never be joined, merged, counted together
-- or copied between.
-- ════════════════════════════════════════════════════════════════════════════════════════

-- LANE-OWNED. SELECT-ONLY. STABLE (Postgres itself refuses any write inside a STABLE function
-- at runtime — that is PS-L8's teeth, not a comment). SECURITY INVOKER (the default): it runs
-- with the caller's rights, so it can never become a privilege-escalation surface.
--
-- IT IS NOT `dedup_match`, and it must never become it:
--   * `dedup_match`'s candidate CTE is `where c.is_published is true` — the exact filter this
--     function must see past, because the whole point is to route the SUBJECT of a HELD row
--     to the consent path instead of minting a duplicate identity for them.
--   * `dedup_match` is fail-closed on `match_claim_allowed_tables`, which legal_listings is
--     NOT a member of. Nothing here adds it, and nothing here merges.
--
-- 🔴 NEVER WIDEN THE `is_published` OMISSION INTO A MERGING MATCHER. The recon measured
-- 49 of 3,000 (1.63%) submissions that would T1 auto_claim a DIFFERENT NAMED ATTORNEY's held
-- row if held rows were made visible to one. This function is safe ONLY because its best
-- outcome is a redirect: it writes nothing, mints nothing and merges nothing.
--
-- Normalisation calls THE DATABASE'S OWN functions — norm_name, norm_phone, norm_domain,
-- street_number — rather than reimplementing them in TypeScript. A TS copy is a second
-- implementation free to drift from the one `dedup_match` uses, and "the same normalisers" is
-- a load-bearing clause of the ruling. All four are provolatile='i' (IMMUTABLE — verified),
-- which is also what makes the D-1 expression indexes legal.
CREATE OR REPLACE FUNCTION legal_lane_find_candidates(
  p_name        text,
  p_phone       text,
  p_website     text,
  p_address     text,
  p_postal_code text
) RETURNS TABLE (
  cand_id       text,
  cand_slug     text,
  cand_name     text,
  sim           real,
  is_published  boolean,
  deserve_reason text,
  phone_match   boolean,
  domain_match  boolean,
  zip_match     boolean,
  snum_match    boolean
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH v AS (
    SELECT norm_name(p_name)      AS v_name,
           norm_phone(p_phone)    AS v_phone,
           norm_domain(p_website) AS v_domain,
           street_number(p_address) AS v_snum,
           nullif(upper(replace(trim(coalesce(p_postal_code,'')),' ','')),'') AS v_postal
  )
  SELECT c.id::text,
         c.slug,
         coalesce(c.name, c.business_name),
         similarity(norm_name(coalesce(c.name, c.business_name)), v.v_name)::real,
         c.is_published,
         c.deserve_reason,
         (v.v_phone  IS NOT NULL AND norm_phone(c.phone) = v.v_phone),
         (v.v_domain IS NOT NULL AND norm_domain(c.website) = v.v_domain),
         (v.v_postal IS NOT NULL AND nullif(upper(replace(trim(coalesce(c.postal_code,'')),' ','')),'') = v.v_postal),
         (v.v_snum   IS NOT NULL AND street_number(c.address) = v.v_snum)
  FROM legal_listings c, v
  -- 🔴 NO `is_published` FILTER. That omission IS the ruling.
  -- US ONLY: this site is hard US-only and freelawyeradvice owns CA. Never widened.
  WHERE c.country = 'US'
    AND (
         (v.v_phone  IS NOT NULL AND norm_phone(c.phone)     = v.v_phone)
      OR (v.v_domain IS NOT NULL AND norm_domain(c.website)  = v.v_domain)
      OR (v.v_postal IS NOT NULL
          AND nullif(upper(replace(trim(coalesce(c.postal_code,'')),' ','')),'') = v.v_postal
          AND similarity(norm_name(coalesce(c.name, c.business_name)), v.v_name) >= 0.3)
    )
  ORDER BY 4 DESC
  LIMIT 25;
$$;

-- `pg_trgm.similarity_threshold` is NOT relied on: the `>= 0.3` above is explicit, exactly as
-- `dedup_match`'s own comment says it keeps it, so correctness never depends on a GUC the
-- pooler role cannot set.

REVOKE ALL ON FUNCTION legal_lane_find_candidates(text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION legal_lane_find_candidates(text,text,text,text,text) TO service_role;
