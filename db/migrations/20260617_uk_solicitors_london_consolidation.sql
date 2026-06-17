-- Roll the 32 London boroughs + City of London into a single 'Greater London' county
-- to prevent per-borough hub fragmentation. Mirrors the accountant working-v3 fix.
-- Source: ONS list of London boroughs (32 boroughs + City of London).

BEGIN;

WITH london_boroughs(borough) AS (VALUES
  ('Barking and Dagenham'),('Barnet'),('Bexley'),('Brent'),('Bromley'),
  ('Camden'),('City of London'),('Croydon'),('Ealing'),('Enfield'),
  ('Greenwich'),('Hackney'),('Hammersmith and Fulham'),('Haringey'),('Harrow'),
  ('Havering'),('Hillingdon'),('Hounslow'),('Islington'),('Kensington and Chelsea'),
  ('Kingston upon Thames'),('Lambeth'),('Lewisham'),('Merton'),('Newham'),
  ('Redbridge'),('Richmond upon Thames'),('Southwark'),('Sutton'),
  ('Tower Hamlets'),('Waltham Forest'),('Wandsworth'),('Westminster')
)
UPDATE public.uk_solicitors
SET county     = 'Greater London',
    updated_at = now()
WHERE county IN (SELECT borough FROM london_boroughs);

COMMIT;
