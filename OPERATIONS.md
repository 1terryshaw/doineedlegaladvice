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

## Legal-help navigator + consolidation (TDL #1402, K443, 2026-11-01)

**Chat is OFF.** `/api/chat` (and `/api/triage` on DINLA) return **410 `chat_disabled`** before any
body parse or Anthropic call. The switch is `LEGAL_FREEFORM_CHAT_ENABLED` and only the exact
string `true` re-enables it. **Do not set it.** Re-enabling is a counsel + CEO gate (K443).
The homepage renders `components/LegalNavigator.tsx`: deterministic, no free text, no network
call, nothing stored.

**Stamped files** (byte-identical in freelawyeradvice + doineedlegaladvice; source
`~/empire/legal-liability-containment-v1/stamp/`): `lib/legal-navigator-data.ts`,
`components/LegalNavigator.tsx`, `lib/legal-chat-gate.ts`, `lib/legal-consolidation.ts`.
Every resource URL was link-checked. A body whose site could not be reached is listed by
name only. Never add a URL you have not checked.

**Consolidation = routing over canonical `legal_listings` rows (DINLA canonical).**
`lib/legal-consolidation.ts :: CA_SERVED_ON_DINLA` = NT PE NL MB NS SK NB (2,576 rows).
- DINLA: `lib/region-scope.ts` turns the list into a chainable `.not(SCOPE_NOT_*)` triple on
  every serve read. An empty list is exactly the old US-only split. `getListingForClaim` stays
  US-pinned. A CA row on DINLA links its claim/manage to FLA, with no upgrade modal, Leads Plus
  or GBP sidecar.
- FLA: `middleware.ts` runs `deserveGate()` (410) FIRST, then an exact-path 301 from
  `lib/dinla-redirects.json`. Each entry was verified FLA 200 + DINLA 200. The sitemap drops
  mapped URLs.
- **Adding a province:** add it to the list in BOTH repos (DINLA first, deploy READY) →
  `build_redirect_map.py` → FLA commit → **re-render the fleet-edge tree** (Design A shadows
  the 301s until re-rendered; standalone `deploy` needs `--no-workers-dev`) → `verify_map.py`.
- **SUPERSEDED by TDL #1407 (below):** every CA province is on DINLA and FLA is retired.
- **Rollback:** `dinla-redirects.json` → `{}` + list → `[]` in both repos, or the
  `working-legal-v1..v4` tags.

## FLA retired — DINLA is the one legal host (TDL #1407, legal-fla-retirement-v1, 2026-11-01)

CEO rulings (K443): **R1** no paid boost in legal ordering (neutral = claimed DESC, google_rating DESC,
name; paid perks unchanged) · **R2** all CA rows incl. claimed + paid on DINLA · **R4** FLA retired
(domain kept, redirect-only); free-form legal chat OFF permanently.
- `CA_SERVED_ON_DINLA` = all 13 CA codes (NU/YT have 0 rows; listed so no navigator link points at FLA).
- DINLA owns CA claim (`getListingForClaim` = `.in(country,[US,CA])`, K148 held → identity queue),
  owner login / magic links / dashboard, Leads Plus, GBP sidecar, upgrade modal and the Reviews Plus
  entitlement. The #1402 `caOnDinla` hand-off is gone. `/canada` = CA landing; `/privacy` 8a = CA section.
- DINLA city hubs match `region_slug OR city_slug` (TDL #1405 fixed).
- `empire_verticals.lawyer.market_domains` CA → doineedlegaladvice.com (checkout/portal return URLs).
- FLA: see `freelawyeradvice/RETIREMENT.md` — 10,751 listing 301s + 487 hub/static 301s, held 410 first,
  owner/claim 301 + API 308 (query preserved), everything else 410 + noindex, empty sitemap, robots crawlable.
- **Never** add a page, a sitemap entry or an owner surface back to FLA; a new CA feature ships on DINLA.
- Monitors: K23 one-shots 2026-11-02 / 11-15 / 12-01 (`~/empire/legal-fla-retirement-v1/monitor/`).
- Rollback tags (both repos): `working-legal-v6` (pre-#1407), `v7` (pre-phase-2), `v8` (pre-retirement).
