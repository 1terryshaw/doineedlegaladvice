# doineedlegaladvice — POST-BUILD

## Leads Plus (leads-plus-fleet-fan-v1, 2026-10-09)

After deploy, in order:
1. `python3 ~/empire/leads-plus-fleet-fan-v1/scripts/verify.py doineedlegaladvice https://<vercel-direct-host> --prod` — gate, no-free-leads,
   [TEST] lead (Resend delivered, Reply-To = customer), inbox, kit, checkout ($19 USD, trial, adaptive off; session expired).
2. `node ~/empire/leads-plus-fleet-fan-v1/scripts/dash.mjs …` @390 + 1280 — one leads surface, $49 line in Mode A only, 0 page errors;
   `--free` — modal + /pricing show Leads Plus $19 + $49 Website, no $9, no annual Leads Plus price.
3. Spot-check 3 random published listings: no form, page 200.
Real owners stay OFF (`leads_plus_enabled=false`) unless Terry says go; $49+ owners are held for Terry.

## Legal-help navigator + consolidation (TDL #1402, 2026-11-01)

After ANY deploy: (1) `curl -X POST /api/chat` (and `/api/triage` on DINLA) must return **410 chat_disabled**;
(2) the homepage must contain `id="legal-nav-region"`; (3) FLA only: re-render the fleet-edge tree
(`node ~/empire/fleet-edge/site.mjs freelawyeradvice all`) and run `verify_map.py` — every
`lib/dinla-redirects.json` entry must 301 to its exact DINLA target, and FLA sitemap ∩ map = 0.
See OPERATIONS.md and K443.
