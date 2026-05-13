# BUILDSPEC: Directory Stamper v3

## Overview
Template for stamping 50-vertical directory empire. Next.js 14, TypeScript, Tailwind, Supabase, Stripe, Claude AI triage chat, Gmail SMTP. Config-driven — one file change to launch a new vertical.

Based on directory-stamper-v2 with critical fixes and improvements from BottomlessPowder (working reference) and getapro debugging (2 days of cookie hell).

## What's New in v3 (vs v2)

### 1. Auth — Use BottomlessPowder Pattern (PROVEN WORKING)
The stamper v2 auth uses `await cookies()` + `cookieStore.set()` which has compatibility issues. v3 uses the BottomlessPowder pattern: `response.cookies.set()` on `NextResponse.redirect()`.

**lib/auth.ts** must match this exact pattern:
```typescript
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";

const COOKIE_NAME = "ds_owner_token"; // stamper default, overridden per vertical
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function generateToken(): string {
  return randomUUID();
}

export function setAuthCookie(
  response: NextResponse,
  token: string,
  slug: string
): void {
  response.cookies.set(COOKIE_NAME, `${slug}:${token}`, {
    httpOnly: true,
    maxAge: MAX_AGE,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export function getAuthFromCookies(
  cookieStore: Awaited<ReturnType<typeof cookies>>
): { slug: string; token: string } | null {
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;
  const separatorIndex = cookie.value.indexOf(":");
  if (separatorIndex === -1) return null;
  const slug = cookie.value.substring(0, separatorIndex);
  const token = cookie.value.substring(separatorIndex + 1);
  if (!slug || !token) return null;
  return { slug, token };
}

export async function verifyOwnerAccess(slug: string): Promise<{ listing: any } | null> {
  const cookieStore = await cookies();
  const auth = getAuthFromCookies(cookieStore);
  if (!auth) return null;
  if (auth.slug !== slug) return null;

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*")
    .eq("slug", slug)
    .eq("owner_auth_token", auth.token)
    .single();

  if (error || !listing) return null;
  return { listing };
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}
```

**app/api/owner/auth/route.ts** must use response.cookies.set() on NextResponse.redirect():
```typescript
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { setAuthCookie } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const slug = searchParams.get("slug");
  const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (!token || !slug) {
    return NextResponse.redirect(`${siteUrl}/owner/login?error=invalid`);
  }

  const { data: listing, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("id, owner_auth_token")
    .eq("slug", slug)
    .single();

  if (error || !listing || listing.owner_auth_token !== token) {
    return NextResponse.redirect(`${siteUrl}/owner/login?error=invalid`);
  }

  const response = NextResponse.redirect(`${siteUrl}/owner/${slug}`);
  setAuthCookie(response, token, slug);
  return response;
}
```

### 2. CRITICAL DOMAIN RULE — NO WWW. EVER.
This caused 2 days of cookie debugging on getapro. The rule for all stamper sites:
- NEXT_PUBLIC_BASE_URL must be `https://domain.com` (NO www)
- Vercel domains: bare domain = Production, www = redirect TO bare domain
- .env.example must include comment: `# IMPORTANT: Use bare domain, NO www (e.g. https://getapro.org NOT https://www.getapro.org)`
- LAUNCH-CHECKLIST must include domain verification step

### 3. Sitemap & Robots (was TODO in v2)
Add `app/sitemap.ts` and `app/robots.ts` as working route handlers:

**app/sitemap.ts:**
```typescript
import { MetadataRoute } from "next";
import verticalConfig from "@/lib/vertical.config";
import { getListings } from "@/lib/supabase";
import { REGIONS } from "@/lib/constants";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${verticalConfig.domain}`;
  const listings = await getListings();

  const staticPages = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily" as const, priority: 1 },
    { url: `${baseUrl}/directory`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.9 },
    { url: `${baseUrl}/pricing`, lastModified: new Date(), changeFrequency: "weekly" as const, priority: 0.7 },
  ];

  const regionPages = REGIONS.map((region) => ({
    url: `${baseUrl}/${region.slug}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const listingPages = listings.map((listing) => ({
    url: `${baseUrl}/directory/${listing.slug}`,
    lastModified: new Date(listing.updated_at || listing.created_at),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...regionPages, ...listingPages];
}
```

**app/robots.ts:**
```typescript
import { MetadataRoute } from "next";
import verticalConfig from "@/lib/vertical.config";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `https://${verticalConfig.domain}`;
  return {
    rules: [
      { userAgent: "*", allow: "/" },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
```

### 4. JSON-LD Structured Data on Listing Pages
Add LocalBusiness schema to `app/directory/[slug]/page.tsx`:
```typescript
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: listing.name,
  description: listing.short_description || listing.description,
  telephone: listing.phone,
  email: listing.email,
  url: listing.website,
  address: {
    "@type": "PostalAddress",
    addressLocality: listing.city,
    addressRegion: listing.province_state,
    addressCountry: listing.country || "CA",
  },
  ...(listing.google_rating && {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: listing.google_rating,
      reviewCount: listing.google_review_count,
    },
  }),
};
// Add <script type="application/ld+json">{JSON.stringify(jsonLd)}</script> to page head
```

### 5. Enhanced LAUNCH-CHECKLIST.md
Replace v2 checklist with comprehensive version including domain setup, cookie verification, and SEO.

### 6. Favicon Placeholder
Include a default `app/favicon.ico` placeholder. Every stamped site MUST replace it.

### 7. Cookie Name from Config
The cookie name should derive from `verticalConfig.tablePrefix`:
```typescript
const COOKIE_NAME = `${verticalConfig.tablePrefix}owner_token`;
```
This prevents cookie collisions if someone visits multiple directory sites.

### 8. No Middleware
Do NOT include middleware.js/ts. It interferes with cookie handling on Vercel. All auth checks happen in page components and API routes.

## File Structure (same as v2, with additions marked with +)
```
app/
  api/
    chat/route.ts
    claim/route.ts
    claim/verify/route.ts
    inquiries/route.ts
    owner/auth/route.ts
    owner/login/route.ts
    owner/logout/route.ts
    owner/update/route.ts
    stripe/checkout/route.ts
    stripe/portal/route.ts
    stripe/webhook/route.ts
  claim/[slug]/page.tsx
  claim/error/page.tsx
  directory/page.tsx
  directory/[slug]/page.tsx
  owner/login/page.tsx
  owner/[slug]/page.tsx
  owner/[slug]/edit/page.tsx
  pricing/page.tsx
  [region]/page.tsx
  favicon.ico
  globals.css
  layout.tsx
  page.tsx
  robots.ts          (+NEW)
  sitemap.ts         (+NEW)
components/          (same as v2, all config-driven)
lib/
  auth.ts            (REWRITTEN — BottomlessPowder pattern)
  constants.ts
  email.ts
  pricing.ts
  stripe.ts
  supabase.ts
  vertical.config.ts
scripts/             (same as v2)
CLAUDE.md
LAUNCH-CHECKLIST.md  (ENHANCED)
.env.example         (UPDATED with domain warning)
```

## .env.example
```
# IMPORTANT: Use bare domain, NO www
# WRONG: https://www.getapro.org
# RIGHT: https://getapro.org
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=PASTE_HERE
NEXT_PUBLIC_SUPABASE_ANON_KEY=PASTE_HERE
SUPABASE_SERVICE_ROLE_KEY=PASTE_HERE

# Stripe
STRIPE_SECRET_KEY=PASTE_HERE
STRIPE_WEBHOOK_SECRET=PASTE_HERE
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=PASTE_HERE

# Anthropic (Claude AI)
ANTHROPIC_API_KEY=PASTE_HERE

# Gmail SMTP
GMAIL_USER=PASTE_HERE
GMAIL_APP_PASSWORD=PASTE_HERE

# Google Places (for seed-photos script only)
GOOGLE_PLACES_API_KEY=PASTE_HERE
```

## LAUNCH-CHECKLIST.md
```markdown
# Launch Checklist — Directory Stamper v3

## Pre-Launch (before going live)

### 1. Config Files
- [ ] `lib/vertical.config.ts` — all CHANGE_ME values replaced
- [ ] `lib/constants.ts` — regions and listing types populated
- [ ] `lib/pricing.ts` — Stripe price IDs pasted
- [ ] `app/favicon.ico` — replaced with vertical-specific icon

### 2. Supabase
- [ ] SQL template run (tables created with correct prefix)
- [ ] RLS policies applied
- [ ] Seed data imported
- [ ] Auth SMTP configured (Gmail, not default Supabase)

### 3. Stripe
- [ ] Products created (run scripts/create-stripe-products.ts)
- [ ] Webhook endpoint configured: https://[domain]/api/stripe/webhook
- [ ] Test checkout flow end-to-end

### 4. Vercel Deployment
- [ ] Repo created (PRIVATE): `gh repo create [name] --private --source=. --push`
- [ ] Vercel project imported
- [ ] .env.local pasted via "Import .env" (never add keys one at a time)
- [ ] Framework Preset = Next.js (check if 404 after deploy)
- [ ] NEXT_PUBLIC_BASE_URL = https://[bare-domain] (NO www!)

### 5. Domain Setup (CRITICAL — NO WWW)
- [ ] Bare domain (e.g. getapro.org) = Production in Vercel
- [ ] www subdomain = 307 redirect TO bare domain
- [ ] Verify: visit www.[domain] → should redirect to [domain]
- [ ] Verify: visit [domain] → should load site directly

### 6. Cookie Auth Verification
- [ ] Request magic link
- [ ] Click magic link → dashboard loads
- [ ] F5 refresh → dashboard stays (cookie persists)
- [ ] Ctrl+Shift+R hard refresh → dashboard stays
- [ ] Close browser, reopen, navigate to /owner/[slug] → dashboard loads
- [ ] IF ANY FAIL: check domain setup (step 5). Cookie mismatch = www issue.

## Post-Launch (within 24 hours)

### 7. Google Search Console & SEO
1. Go to https://search.google.com/search-console
2. Add Property → Domain type → enter bare domain
3. Add DNS TXT record: Host = @ , Value = verification string
4. Verify in Search Console
5. Submit sitemap: https://[domain]/sitemap.xml
6. Request Indexing on homepage + 3-5 key pages

### 8. Smoke Test
- [ ] Homepage loads
- [ ] Directory page shows listings
- [ ] Individual listing page works
- [ ] Claim flow sends email
- [ ] Inquiry form sends email
- [ ] Chat widget responds
- [ ] Pricing page shows tiers
- [ ] Stripe checkout flow works
- [ ] Owner login → dashboard → edit → save works
```

## CLAUDE.md Updates for v3
Add these rules to existing CLAUDE.md:
```
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
```

## Build Instructions for CCW

### Session Prompt:
```
TASK: Build directory-stamper-v3 from scratch

This is a NEW project — do not reference or modify directory-stamper-v2.
Use the BUILDSPEC-STAMPER-V3.md file in this repo as the complete specification.

Base the project on directory-stamper-v2's architecture but with these critical changes:
1. Auth pattern from BottomlessPowder (response.cookies.set on NextResponse.redirect)
2. sitemap.ts and robots.ts included
3. JSON-LD structured data on listing pages
4. Enhanced LAUNCH-CHECKLIST.md with domain/cookie verification
5. No middleware.js/ts
6. Cookie name derived from verticalConfig.tablePrefix
7. .env.example with NO-WWW warning

Tech stack: Next.js 14.2.35, TypeScript, Tailwind CSS, Supabase, Stripe, Nodemailer.

STRICT VERIFICATION PROTOCOL:
1) READ each file before modifying
2) Start dev server (npx next dev)
3) Test every endpoint with curl — paste full response
4) If error, fix and retest. Repeat until success
5) Do NOT commit until curl returns success
6) Run ls, git status, git diff --name-only
7) Commit, push, show hash

PRE-FLIGHT CHECK:
Before starting any build work, verify:
1) All template files compile (npm run build)
2) No TypeScript errors
3) Report any failures before writing code

IMPORTANT: Never commit .env files. Verify .gitignore contains .env, .env.local, .env.production, .env*.local — check BEFORE first commit.

Work on master branch.
```
