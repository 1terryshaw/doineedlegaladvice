-- UK solicitor pilot — Session 2
-- Cheap aggregate views powering the /uk geo hubs. Mirrors accountant supabase/uk/002.
-- Both views are is_published-gated → BEFORE the publish flip they return ZERO rows
-- (no hub pages render → real 404s, no thin/empty pages). AFTER the flip they reflect
-- live published counts. Routes filter by the pre-computed *_slug columns.
--
-- The slug expression MUST stay byte-for-byte identical to ukSlugify() in
-- lib/uk-solicitors.ts:  lower(x) -> runs of [^a-z0-9] become '-' -> trim leading/trailing '-'.

CREATE OR REPLACE VIEW public.uk_solicitors_county_stats AS
SELECT
  county,
  btrim(regexp_replace(lower(county), '[^a-z0-9]+', '-', 'g'), '-') AS county_slug,
  count(*) AS firm_count
FROM public.uk_solicitors
WHERE is_published = true
  AND county IS NOT NULL
GROUP BY county;

CREATE OR REPLACE VIEW public.uk_solicitors_town_stats AS
SELECT
  county,
  town,
  btrim(regexp_replace(lower(county), '[^a-z0-9]+', '-', 'g'), '-') AS county_slug,
  btrim(regexp_replace(lower(town),   '[^a-z0-9]+', '-', 'g'), '-') AS town_slug,
  count(*) AS firm_count
FROM public.uk_solicitors
WHERE is_published = true
  AND county IS NOT NULL
  AND town   IS NOT NULL
GROUP BY county, town;

REVOKE ALL ON public.uk_solicitors_county_stats FROM anon, authenticated;
REVOKE ALL ON public.uk_solicitors_town_stats   FROM anon, authenticated;
