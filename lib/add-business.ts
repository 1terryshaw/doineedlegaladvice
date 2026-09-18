// Route-presence flag for the self-serve add-business surface (app/list-your-business).
//
// 🔴 FLIPPED TRUE 2026-09-18 — newbiz-submissions-dinla-lane-build-v1, TDL #1243 addendum 5.
// This is the LAST commit of that build, deliberately: the routes, the seam gate, the
// migration and the end-to-end probes all landed and were proven with this still FALSE.
//
// It is a ROUTE-PRESENCE FLAG, NOT A POLICY SWITCH (this file's original header said so and it
// is still true). What it decides is whether the site ADVERTISES the lane and whether the
// intake accepts a submission — the lane's SAFETY properties are structural and do not depend
// on it: is_published DEFAULT false, a CHECK that makes publication impossible before a
// mailbox is proven, RLS with zero policies and no anon grant, noindex, no licence column to
// fabricate, and no path from a lane row to legal_listings.
//
// Flipping it relights three affordances that were suppressed to avoid dangling links:
//   - components/ClaimOrAddHub.tsx    the /claim "Route 2" card (copy AMENDED — the donor's
//                                     Google Maps promise is gone; the lane collects no Google
//                                     identifier of any kind)
//   - app/directory/[slug]/page.tsx   the "Add your business →" footer link
//   - app/list-your-business          the intake itself, which 404s while this is false
//
// It also makes the site's own top-level CTA true for the first time: the header has read
// "Claim or Add Your Business" → /claim on every page, and until now the "Add" half was a
// promise the site could not keep.
export const HAS_LIST_YOUR_BUSINESS = true;
