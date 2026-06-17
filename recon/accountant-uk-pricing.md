# Accountant /uk pricing recon — Session 2 Phase A

**Date:** 2026-06-17 · donor = `~/empire/nav-fix/doineedanaccountant`

## Finding: accountant /uk ships NO paid pricing surface — free Verified claim only.

- **No `app/uk/pricing/` directory.** No GBP price strings (`£`, `priceGbp`, `GBP`) anywhere
  under `app/uk/` or `lib/uk-*`.
- The only pricing reference is a comment in `app/uk/directory/[slug]/page.tsx`:
  `Claim CTA — free Verified only this session. TODO(UK-PRICING): once the GBP [tiers]…`
- The `empire_verticals.accountant_uk` row `notes` confirm: *"SEO core + free Verified claim
  live Session 2 (2026-06-15). GBP paid tiers deferred — TODO(UK-PRICING)."*
- No Stripe price IDs referenced on the /uk path (claim flow is free, no checkout).

## Implication for solicitor /uk

Mirror exactly: **free Verified claim, no pricing page, no Stripe, `TODO(UK-PRICING)` markers
left in place.** Matches the buildspec's locked "Free Verified claim flow" decision. GBP rate
card is a future workstream (Terry decision), not this session.

## Full donor /uk inventory (port ALL of these, not just the buildspec's partial list)

Routes: `app/uk/page.tsx`, `app/uk/[county]/page.tsx`, `app/uk/[county]/[town]/page.tsx`,
`app/uk/directory/[slug]/page.tsx`, `app/uk/claim/[slug]/page.tsx`, `app/uk/privacy/page.tsx`,
`app/uk/sitemap.xml/route.ts`, `app/uk/sitemap/[id]/route.ts`.
API: `app/api/uk/claim/route.ts`, **`app/api/uk/claim/verify/route.ts`** (missed by spec),
`app/api/uk/health/route.ts`.
Lib: `lib/uk-accountants.ts`, `lib/uk-seo.ts`, `lib/uk-claim-email.ts`.
Components: **`components/uk/UkListingCard.tsx`**, **`components/uk/UkClaimForm.tsx`** (missed by spec).
