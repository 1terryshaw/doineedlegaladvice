-- sql/migrate-costcalc-lawyer-us.sql
-- Adds the US market rows for the lawyer cost estimator on doineedlegaladvice.com
-- (international consolidation 2026-06-17). The 7 CA rows already exist and are
-- REUSED — this migration touches ONLY market='us' rows. Idempotent via the
-- (vertical, market, service) unique key. Slugs / units / complexity multipliers
-- are IDENTICAL to the CA rows; only the USD base ranges differ (Terry-approved
-- 2026-06-17). All flat-fee, attorney-drafted, excluding court / state filing fees.
-- Contingency matters (PI, class action, med-mal) are intentionally NOT modeled
-- (billed as % of settlement — see verticalConfig.costEstimator.disclaimerExtension).

INSERT INTO cost_models
  (vertical, market, service, service_label, base_low, base_high, unit, complexity_options, sort_order)
VALUES
  ('lawyer','us','simple-will','Simple will', 300, 1000,'flat',
     '{"Individual": 1.0, "Couple (mirror wills)": 1.6}'::jsonb, 10),
  ('lawyer','us','incorporation','Business incorporation', 900, 3000,'flat',
     '{"Standard": 1.0, "With agreements / share structure": 1.8}'::jsonb, 20),
  ('lawyer','us','real-estate-closing','Real estate purchase closing', 900, 2500,'flat',
     '{"Standard": 1.0, "With mortgage / complex": 1.4}'::jsonb, 30),
  ('lawyer','us','uncontested-divorce','Uncontested divorce', 1200, 4000,'flat',
     '{"With agreement": 1.5, "No children/property": 1.0}'::jsonb, 40),
  ('lawyer','us','small-claims','Small claims representation', 700, 2500,'flat',
     '{"Standard": 1.0}'::jsonb, 50),
  ('lawyer','us','name-change','Legal name change', 400, 1200,'flat',
     '{"Standard": 1.0}'::jsonb, 60),
  ('lawyer','us','traffic-ticket','Traffic ticket defense', 250, 900,'flat',
     '{"Standard": 1.0, "With court appearance": 1.6}'::jsonb, 70)
ON CONFLICT (vertical, market, service) DO UPDATE SET
  service_label = EXCLUDED.service_label,
  base_low = EXCLUDED.base_low,
  base_high = EXCLUDED.base_high,
  unit = EXCLUDED.unit,
  complexity_options = EXCLUDED.complexity_options,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
