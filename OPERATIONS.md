# doineedlegaladvice — Operations

## Vercel WAF

- 2026-09-11 — WAF rule `TDL983 chat sustained cap` (`rule_tdl_983_chat_sustained_cap_trdC15`, 100 req / 3600s per IP on `POST /api/chat`) flipped `deny` → `rate_limit`: it was returning a hard 403 on the chat route, so over-cap users now get a 429 instead of being blocked. Scope, window and limit unchanged; burst rule `TDL983 chat burst limit` (10/60s) and the junk-crawler deny rule untouched. Firewall config v7 → v10; before/after JSON in `~/empire/qa/2026-09-11/`.

## Leads Plus (leads-plus-fleet-fan-v1, 2026-10-09)

Ported from the canary as built (doineedabookkeeper @ ef58aa0 ← doineedanelectrician; K378). Same code, same gates.
- **Gate (one):** `leadFormGate()` in `lib/leads-plus.ts` = claimed AND owner email confirmed AND Leads Plus entitlement
  (`reviews_plus`/`website`/`growth`, R1/R2) AND `legal_listings.leads_plus_enabled`. Free + unclaimed listings never get a form (R9/R10).
- **No free leads:** the legacy `InquiryForm` is deleted; `/api/forward-lead` + `/api/inquiries` return 403.
- **Tables:** `legal_leads` + `legal_lead_taps` (service-role only, RLS on, anon/authenticated revoked — verified at migrate);
  purge fn `legal_leads_purge()` created, **NOT scheduled**. Schema: `sql/migrate-leadsplus.sql` + `sql/migrate-leadsplus-p6.sql`
  (applied 2026-10-09); fresh DB: `sql/setup-fresh-leadsplus.sql`.
- **Activation:** a Leads Plus purchase/trial sets `tier=reviews_plus` + `leads_plus_enabled=true` (empire-billing webhook), so a
  new buyer is live with no manual flip. Manual flip (only on Terry's word):
  `UPDATE legal_listings SET leads_plus_enabled=true WHERE slug='<slug>' AND claimed AND stripe_subscription_id IS NOT NULL;`
  then `~/empire/bin/empire-revalidate.sh doineedlegaladvice <slug>`; verify Vercel-direct (the CF edge lags ≤ 30 min).
- **R11:** new checkouts = Leads Plus $19 USD/mo, monthly only, 30-day trial + "Skip trial, pay now", adaptive pricing off.
  Existing $9 subs untouched; nothing archived in Stripe.
- **Pricing cards:** Free (no inquiry form) · Leads Plus $19 (Reviews Plus included) · Website $49 (free preview first) ·
  Website + AI Receptionist $99. No annual price on Leads Plus (the toggle leaves monthly-only cards at /mo).
- **Kit profile:** `trade`.
- **Monthly changes kit:** `lead_monthly_kit_enabled` stays OFF for real owners; `scripts/leads-plus-nudge.ts` is render-only, unscheduled.
- **Test fixture:** `test-leadsplus-demo-legaladvice` (region ZZ, noindex, `source='admin_manual'`, owner = terry@).
  Every test email subject starts `[TEST]`; test leads go only to terry@marketingteaminabox.com.
- **Build guard:** `prebuild` runs `scripts/check-client-imports.mjs` (no `'use client'` file may reach the Stripe client).
- **Health:** `/api/health` green after deploy.
- **Prod branch:** `main`. Rollback (only if prod got WORSE): `git reset --hard working-v-leadsplus-fan-pre && npx vercel --prod`.
