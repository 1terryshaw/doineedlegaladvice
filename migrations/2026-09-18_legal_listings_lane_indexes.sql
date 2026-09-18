-- ════════════════════════════════════════════════════════════════════════════════════════
-- D-1 · spec §2.4 — TWO READ ACCELERATORS ON legal_listings. RULED AND AUTHORISED.
--
-- 🔴 RUN THESE OUTSIDE A TRANSACTION. `CREATE INDEX CONCURRENTLY` cannot run inside one.
-- Apply as `postgres` over DATABASE_URL (session pooler, 5432), statement by statement.
--
-- ── WHY ──────────────────────────────────────────────────────────────────────────────────
-- Measured this arc, EXPLAIN (ANALYZE, BUFFERS) on the §2.2 retrieval predicate:
--   Parallel Seq Scan on legal_listings (rows removed by filter: 171,319 × 3 workers)
--   Buffers: shared hit=68,947 read=9 · Execution Time: 4770.941 ms
-- 4.77 seconds and ~69k buffers PER SUBMISSION. There is no index on `phone`, none on
-- `postal_code`, and no expression index on any normaliser (31 indexes enumerated; none
-- applies). On a Vercel function that is a user-visible stall, a real Active-CPU cost, and a
-- cheap way for an unauthenticated POST to make the database work hard.
--
-- ── WHAT THIS IS NOT, AND THE DISTINCTION MUST SURVIVE REVIEW ───────────────────────────
-- NO column is added. NO trigger is created. NO row is written. NO value is backfilled. NO
-- matcher-registry row is inserted. `CONCURRENTLY` takes NO blocking lock. This is two read
-- accelerators on an existing table — categorically not donor A's DDL, which was 5 columns +
-- a norm-maintenance trigger + a 513,962-row backfill + a matcher registry INSERT.
--
-- THIS FILE IS THE ONLY TOUCH ON legal_listings IN THE ENTIRE BUILD. Zero rows are created,
-- changed or deleted at any point, which is why no row-level restore manifest is owed.
--
-- Both expressions are IMMUTABLE (`norm_phone` provolatile='i', verified), which is what
-- makes them indexable at all.
--
-- Why no trigram GIN: the postal branch blocks first, and tightly — measured on US rows,
-- 33,905 distinct postal keys, mean 4.0 rows, p99 47, max 1,194. After the postal index, name
-- similarity runs over tens of rows, not half a million.
-- ════════════════════════════════════════════════════════════════════════════════════════

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_legal_listings_lane_phone_norm
  ON legal_listings (norm_phone(phone)) WHERE country = 'US' AND phone IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_legal_listings_lane_postal_key
  ON legal_listings ((nullif(upper(replace(trim(coalesce(postal_code,'')),' ','')),'')))
  WHERE country = 'US' AND postal_code IS NOT NULL;

-- ════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 THESE INDEXES ARE INERT ON THEIR OWN. The finder's OR branches MUST carry an explicit
-- `c.phone IS NOT NULL` / `c.postal_code IS NOT NULL`, or Postgres cannot prove the query
-- predicate implies these partial indexes' predicate and discards them. Measured on
-- production, same row, same predicate: 4,773 ms Parallel Seq Scan without those clauses,
-- 0.167 ms BitmapOr with them. Creating the indexes and stopping there fixes nothing — it was
-- verified by measuring, not by observing that the CREATE INDEX succeeded.
--
-- ⚠️ RESIDUAL, REPORTED NOT FIXED: the finder's THIRD branch matches on `norm_domain(website)`
-- and there is NO index for it. A BitmapOr needs every branch index-backed, so a submission
-- that supplies a website falls back to a seq scan: 2,503 ms, against 0.167 ms without.
-- A third index would close it —
--     CREATE INDEX CONCURRENTLY idx_legal_listings_lane_domain_norm
--       ON legal_listings (norm_domain(website)) WHERE country='US' AND website IS NOT NULL;
-- — but D-1 authorised exactly TWO indexes on this table, so that is an operator decision, not
-- a build one. The residual is bounded: only 6,322 of 503,211 US rows carry a website at all,
-- and the intake is rate-limited to 3 submissions per address per 24 hours.
-- ════════════════════════════════════════════════════════════════════════════════════════

-- ROLLBACK (no data loss, no lock):
--   DROP INDEX CONCURRENTLY IF EXISTS idx_legal_listings_lane_phone_norm;
--   DROP INDEX CONCURRENTLY IF EXISTS idx_legal_listings_lane_postal_key;
