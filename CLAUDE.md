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
