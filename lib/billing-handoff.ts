import { SignJWT } from 'jose';

export type HandoffPayload = {
  vertical: string;
  listing_slug: string;
  owner_email: string;
  tier: 'lead_boost' | 'website' | 'growth';
  cycle: 'monthly' | 'annual';
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
