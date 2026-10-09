# DoINeedLegalAdvice.com

## Tech Stack
- Next.js 14.2.35, TypeScript, Tailwind CSS
- Supabase (database + storage)
- Stripe (payments)
- Nodemailer (Gmail SMTP)
- Claude AI (chat triage)

## Architecture
Config-driven directory template. One file change (`lib/vertical.config.ts`) to launch a new vertical.

## Domain Rules
- NEVER use www in NEXT_PUBLIC_BASE_URL
- NEVER set Domain attribute on cookies (let browser default to request origin)
- NO middleware.js/ts — it interferes with cookie handling on Vercel
- Cookie name derives from table prefix: `${tablePrefix}owner_token`

## Auth Pattern (BottomlessPowder-proven)
- setAuthCookie() uses response.cookies.set() on NextResponse — NOT cookieStore.set()
- Auth route: validate token → NextResponse.redirect() with cookie set on response
- Verify route: await cookies() → parse → check Supabase
- Cookie format: slug:token (no encoding, colon is safe per RFC 6265)

## Key Files
- `lib/vertical.config.ts` — central config (name, domain, tablePrefix, colors, etc.)
- `lib/constants.ts` — regions and listing types
- `lib/auth.ts` — cookie auth (BottomlessPowder pattern)
- `lib/supabase.ts` — database client and helpers
- `lib/pricing.ts` — Stripe tier definitions
- `lib/email.ts` — Gmail SMTP via Nodemailer

## Development
```bash
npm install
npm run dev     # Start dev server
npm run build   # Production build
npm run lint    # Lint check
```

## Stamping a New Vertical
1. Clone this repo
2. Update `lib/vertical.config.ts` (all CHANGE_ME values)
3. Update `lib/constants.ts` (regions, listing types)
4. Update `lib/pricing.ts` (Stripe price IDs)
5. Replace `app/favicon.ico`
6. Follow LAUNCH-CHECKLIST.md

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
