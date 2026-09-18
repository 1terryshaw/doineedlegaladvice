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
  -- ════════════════════════════════════════════════════════════════════════════════════
  -- 🔴 THE RETRIEVAL IS A **UNION OF THREE SEPARATELY-PLANNED BRANCHES**, NOT ONE `OR`.
  -- REWRITING IT BACK INTO AN `OR` SILENTLY RESTORES A 27,000x REGRESSION.
  --
  -- The obvious shape is `WHERE country='US' AND (phone… OR domain… OR postal…)`, and it was
  -- what shipped first. It is measurably wrong, for a reason that only appears in production:
  --
  --   * PostgREST calls this through a PREPARED STATEMENT. After five executions PostgreSQL
  --     switches to a GENERIC plan, in which the parameter values are opaque.
  --   * Under a generic plan the planner must pick ONE plan covering all three OR branches.
  --     The domain branch has no index, so it discards the two D-1 indexes and scans the
  --     whole table.
  --
  --   MEASURED ON PRODUCTION, same arguments, same function:
  --     custom plan  (values known):  0.277 ms · BitmapOr over both D-1 indexes
  --     generic plan (values opaque): 7,444 ms · scan over 510,668 rows
  --
  --   The live symptom was not slowness, it was a 503: the intake route's fail-closed
  --   FINDER_UNAVAILABLE fired on a real preview submission. An EXPLAIN with literal arguments
  --   shows 0.8 ms and looks perfect — the defect is invisible unless you measure the
  --   parameterised path.
  --
  --   `ALTER FUNCTION … SET plan_cache_mode='force_custom_plan'` was tried and REJECTED: the
  --   SET clause makes the function non-inlinable and the body still planned generically —
  --   8,279 ms, measured, worse than doing nothing.
  --
  -- As a UNION, each branch is planned on its own, so the phone and postal branches use their
  -- D-1 indexes even under a generic plan. Each branch is also guarded by a PARAMETER-ONLY
  -- predicate (`norm_phone(p_phone) IS NOT NULL`), which is a runtime constant — so a branch
  -- whose input was not supplied is skipped by a One-Time Filter instead of being scanned.
  -- That is what keeps the unindexed domain branch from costing anything when no website was
  -- submitted, which is the overwhelming majority of submissions.
  --
  -- The guards deliberately call the normalisers on the PARAMETER rather than reading them
  -- from a CTE: a reference to a CTE column is not a runtime constant, and the One-Time Filter
  -- would be lost.
  -- ════════════════════════════════════════════════════════════════════════════════════
  WITH v AS (
    SELECT norm_name(p_name)      AS v_name,
           norm_phone(p_phone)    AS v_phone,
           norm_domain(p_website) AS v_domain,
           street_number(p_address) AS v_snum,
           nullif(upper(replace(trim(coalesce(p_postal_code,'')),' ','')),'') AS v_postal
  ),
  cand AS (
    -- BRANCH 1 — phone exact. Uses idx_legal_listings_lane_phone_norm.
    -- `c.phone IS NOT NULL` is LOAD-BEARING and semantically redundant: the index is PARTIAL
    -- on `country='US' AND phone IS NOT NULL`, and the planner cannot derive non-nullity from
    -- `norm_phone(phone) = $1` — the function is a black box to the prover. Without it the
    -- index is discarded. DO NOT "SIMPLIFY" IT AWAY.
    SELECT c.id
      FROM legal_listings c
     WHERE norm_phone(p_phone) IS NOT NULL
       AND c.country = 'US'
       AND c.phone IS NOT NULL
       AND norm_phone(c.phone) = norm_phone(p_phone)
    UNION
    -- BRANCH 2 — domain exact. NO INDEX EXISTS FOR THIS, deliberately: D-1 authorised exactly
    -- two indexes on legal_listings and a third is the operator's call. Isolated in its own
    -- branch, it costs nothing unless a website was actually submitted, and only 6,322 of
    -- 503,211 US rows carry one at all.
    SELECT c.id
      FROM legal_listings c
     WHERE norm_domain(p_website) IS NOT NULL
       AND c.country = 'US'
       AND c.website IS NOT NULL
       AND norm_domain(c.website) = norm_domain(p_website)
    UNION
    -- BRANCH 3 — postal key ∩ name similarity. Uses idx_legal_listings_lane_postal_key.
    -- The `>= 0.3` is EXPLICIT, exactly as dedup_match's own comment says it keeps it, so
    -- correctness never depends on the pg_trgm.similarity_threshold GUC — which the pooler
    -- role cannot set anyway.
    SELECT c.id
      FROM legal_listings c
     WHERE nullif(upper(replace(trim(coalesce(p_postal_code,'')),' ','')),'') IS NOT NULL
       AND c.country = 'US'
       AND c.postal_code IS NOT NULL
       AND nullif(upper(replace(trim(coalesce(c.postal_code,'')),' ','')),'')
           = nullif(upper(replace(trim(coalesce(p_postal_code,'')),' ','')),'')
       AND similarity(norm_name(coalesce(c.name, c.business_name)), norm_name(p_name)) >= 0.3
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
    FROM legal_listings c
    JOIN cand ON cand.id = c.id
   CROSS JOIN v
  -- 🔴 STILL NO `is_published` FILTER ANYWHERE ABOVE. That omission IS the ruling: the finder
  -- must SEE held rows so it can route their subjects to the consent path instead of minting a
  -- duplicate identity for them. Never widen it into a merging matcher — the recon measured
  -- 49 of 3,000 (1.63%) submissions that would auto-claim a DIFFERENT named attorney's held row.
   ORDER BY 4 DESC
   LIMIT 25;
$$;

-- `pg_trgm.similarity_threshold` is NOT relied on: the `>= 0.3` above is explicit, exactly as
-- `dedup_match`'s own comment says it keeps it, so correctness never depends on a GUC the
-- pooler role cannot set.

REVOKE ALL ON FUNCTION legal_lane_find_candidates(text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION legal_lane_find_candidates(text,text,text,text,text) TO service_role;
