// Route-presence flag for the self-serve add-business surface (app/list-your-business).
//
// TDL #1304(d): this vertical is CLAIM-ONLY. The /list-your-business pages and
// /api/list-your-business* routes still exist; laneOpen() reads this constant and
// 404s them while it is false. The /claim "Route 2" card is inside the same flag,
// so it stays off with the intake. The listing-page "Add your business" line is
// removed from the template (it linked at the same surface).
export const HAS_LIST_YOUR_BUSINESS = false;
