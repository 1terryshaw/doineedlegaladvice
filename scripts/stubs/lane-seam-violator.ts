/**
 * RED CONTROL for PS-L1. NOT SHIPPED, NOT IMPORTED BY ANYTHING.
 *
 * A detector that cannot see a planted writer cannot see a regression. This file plants one
 * of each form the matcher must catch, and the gate additionally asserts that this file is
 * outside every lane import closure — so the control can never itself become the violation.
 */
export async function plantedPostgrestWriter(db: any) {
  return db.from("legal_listings").update({ is_published: true }).eq("slug", "x");
}
export const plantedRawWriter = `UPDATE legal_listings SET is_published = true WHERE slug = 'x'`;
export const plantedCredentialTouch = `select owner_auth_token from somewhere`;
