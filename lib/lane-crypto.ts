import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * THE LANE'S CREDENTIAL PRIMITIVES (newbiz-submissions-dinla-lane-spec-v1 §1.2).
 *
 * ── WHY THE LANE HAS ITS OWN, AND DOES NOT REUSE `lib/auth.ts` ───────────────────────
 * `lib/auth.ts` is the DIRECTORY's owner-auth: it reads and writes `legal_listings`
 * (`owner_auth_token`, a PLAINTEXT column) and it is part of the claim funnel's surface.
 * The lane must not reach it at any depth — PS-L1 asserts exactly that — and it must not
 * copy its shape either: a SELECT on the lane table must never hand the reader a live
 * credential.
 *
 * So the lane stores DIGESTS ONLY. `verify_token_sha256`, `owner_session_sha256` and
 * `owner_csrf_sha256` are the only credential-shaped values on the row, and none of them
 * can be replayed.
 *
 * Deliberately NOT `server-only`: these are pure functions and the Layer-1 harness drives
 * the REAL ones, never a copy.
 */

/** Hex SHA-256. The lane's only credential-at-rest form. */
export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Constant-time compare over two hex digests.
 *
 * Lengths are compared first and a mismatch returns false WITHOUT calling
 * `timingSafeEqual` — that function THROWS on unequal lengths, and a throw inside an
 * authorisation predicate is a 500 where a `false` was owed.
 */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** A fresh URL-safe secret. 32 bytes of CSPRNG output, base64url — never a UUID. */
export function newSecret(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Crockford-ish base32 of a UUID's hex, used for the lane slug's uniqueness suffix (§1.3).
 *
 * 🔴 THE SUFFIX IS DERIVED FROM THE ROW'S OWN UUID, NOT FROM A CROSS-TABLE EXISTENCE PROBE.
 * "Namespacing the lane slug against `legal_listings`" would be a statement naming both
 * tables — the exact thing PS-L4 forbids, and the K38 guarantee is worth more than the
 * instinct. The two URL spaces (`/listed/{slug}` vs `/directory/{slug}`) are disjoint
 * anyway, so a same-string slug in the two tables is two pages, not a collision.
 */
const B32 = "0123456789abcdefghjkmnpqrstvwxyz";
export function b32FromUuid(uuid: string): string {
  const hex = (uuid || "").replace(/[^0-9a-fA-F]/g, "");
  let out = "";
  for (let i = 0; i + 1 < hex.length && out.length < 12; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    out += B32[byte & 31];
  }
  // TOTAL, AND ALWAYS THE SAME WIDTH. The first version early-returned a 6-char string for an
  // unparseable uuid and a 12-char one otherwise, and padded with a fixed 6 zeros that could
  // still leave a short input short. A width that depends on the input is a contract that a
  // caller slicing a different number of characters would silently violate.
  return out.padEnd(12, "0").slice(0, 12);
}
