# /api/unsubscribe port recon (PECR prerequisite for UK solic canary)

Donor: `~/empire/nav-fix/doineedanaccountant` (live, working). Ported verbatim.

## The four points

1. **Token scheme = UNSIGNED email** (NOT hmac). The "token" is the URL-encoded email with a `u-`
   QP-hardening prefix; the route strips exactly one `u-`. Per the route comment: *"Unsigned email
   param, per the signed-off doineedapro baseline."* So the buildspec's hmac/`signUnsubToken`
   assumption does **not** apply — and this **matches the E1 template exactly**
   (`/api/unsubscribe?email=u-{email}&scope=pitch`). No mismatch.
2. **email_suppressions write:** `suppressEmail(email, 'claim_pitch_unsubscribe', 'claim_pitch_one_click')`
   inserts `{email, reason, source}` (idempotent on the unique `email_normalized`). This is the
   authoritative, cross-vertical write the canary HALT/suppression reads.
3. **Vertical-agnostic:** the route + helper write to the shared `email_suppressions` table; no
   vertical param, no per-vertical hmac lookup. The `scope=pitch` branch also fail-softly updates
   `LISTINGS_TABLE.outreach_unsubscribed` (here = legal_listings) — wrapped in `.then(undefined,()=>undefined)`,
   so a missing column / no-match is harmless. Ports clean.
4. **Responses:** GET → human HTML confirmation page (200). POST (RFC 8058 one-click) → JSON `{success}`
   (200). Missing/invalid params → 400 HTML. The dormant `?token=&email=` (cold-outreach) and
   `?slug=&token=` (owner-notification) branches are inherited but unused by the UK solic canary
   (which only uses `scope=pitch`).

## Port
- `app/api/unsubscribe/route.ts` ← verbatim. `lib/suppression.ts` ← verbatim. Imports
  (`../../../lib/supabase` → supabaseAdmin + LISTINGS_TABLE; `@/lib/suppression` → suppressEmail)
  resolve in this repo. tsc clean.
