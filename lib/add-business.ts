// Route-presence flag for the self-serve add-business surface (app/list-your-business).
// FALSE here because this vertical has no add-business route yet, so the owner-claim
// uplift's "Add Your Business" affordances (ClaimOrAddHub Route 2 + the directory-page
// "Add your business" link) are suppressed to avoid dangling links.
//
// When the self-serve add-business arc later fans a /list-your-business route to this
// vertical, flip this single constant to `true`: both affordances relight automatically
// with NO edit to ClaimOrAddHub or the directory page.
export const HAS_LIST_YOUR_BUSINESS = false;
