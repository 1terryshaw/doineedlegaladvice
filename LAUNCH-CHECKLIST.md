# Launch Checklist — Directory Stamper v4

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
- [ ] Check Settings → Git → Production Branch matches your branch name (main or master)
- [ ] After first deploy: Deployments → promote latest to Production if it deployed as Preview

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
- [ ] Visit /directory/[any-slug] — detail page loads (NOT 404)
- [ ] Visit /directory?type=[category] — shows filtered results
- [ ] Claim flow sends email
- [ ] Inquiry form sends email
- [ ] Chat widget responds
- [ ] Pricing page shows tiers
- [ ] Stripe checkout flow works
- [ ] Owner login → dashboard → edit → save works

## Stamping a New Vertical

```bash
# 1. Clone the template
git clone [template-repo-url] [new-directory-name]
cd [new-directory-name]

# 2. Run npm install in the project folder
npm install

# 3. Re-initialize git with main branch
rm -rf .git
git init -b main

# 4. Update config files (see steps 1-4 above)
# 5. Install and test locally
npm install
npm run build
npm run dev

# 5. Create repo and push
gh repo create [name] --private --source=. --push
```
