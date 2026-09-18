-- RED CONTROL for PS-L8. NOT APPLIED ANYWHERE, NOT REFERENCED BY ANY MIGRATION CHAIN.
--
-- A VOLATILE variant of the finder carrying a write. PS-L8's repo-side locks are "declares
-- STABLE" and "no DML in the body"; this file is what proves both matchers actually fire,
-- rather than passing because the real file happens to be quiet.
CREATE OR REPLACE FUNCTION legal_lane_find_candidates_BAD() RETURNS void
LANGUAGE sql
VOLATILE
AS $$
  UPDATE legal_listings SET is_published = true WHERE slug = 'x';
$$;
