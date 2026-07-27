import { SignJWT } from 'jose';

export type HandoffPayload = {
  vertical: string;
  listing_slug: string;
  owner_email: string;
  tier: 'reviews_plus' | 'website' | 'growth';
  cycle: 'monthly' | 'annual';
  /** Checkout intent. 'trial' → 30-day Stripe trial; 'direct' → bill now.
   *  Optional for backward compatibility; empire-billing defaults to 'direct'. */
  mode?: 'trial' | 'direct';
};

const TOKEN_TTL_SECONDS = 5 * 60;

function secretKey(): Uint8Array {
  const secret = process.env.BILLING_HMAC_SECRET;
  if (!secret) throw new Error('BILLING_HMAC_SECRET not set');
  return Uint8Array.from(Buffer.from(secret, 'base64'));
}

export async function signBillingHandoff(payload: HandoffPayload): Promise<string> {
  const vertical = process.env.BILLING_VERTICAL_SLUG;
  if (!vertical) throw new Error('BILLING_VERTICAL_SLUG not set');
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(vertical)
    .setAudience('empire-billing')
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

/**
 * Signs the short-lived JWT for the two-tier-display place-id resolve endpoint
 * (empire-billing /api/place-id/resolve). Same per-vertical HS256 secret + issuer as the
 * billing handoff; distinct audience. Fire-and-forget from claim/verify — never blocks a claim.
 */
export async function signPlaceResolve(listing_id: string, slug: string): Promise<string> {
  const vertical = process.env.BILLING_VERTICAL_SLUG;
  if (!vertical) throw new Error('BILLING_VERTICAL_SLUG not set');
  return await new SignJWT({ vertical, listing_id, slug })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(vertical)
    .setAudience('empire-place-resolve')
    .setExpirationTime('120s')
    .sign(secretKey());
}
