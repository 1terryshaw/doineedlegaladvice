// owner-auth-hardening-and-edit-log-v1 (2026-09-26) — THE canonical server-side owner-session
// revocation check. Every owner entry point in lib/auth.ts (getAuthorizedOwnerListing,
// getControlledOwnerListings, verifyOwnerAccess, getActiveOwnerAuth) calls isOwnerSessionRevoked()
// after it has matched the cookie's token to the listing row, so a session revoked via
// owner_session_meta.revoked_at is refused on the dashboard, every edit/save, photo, GBP, billing
// and lead route, the /me header state and the magic-link landing — not only on /api/owner/me.
//
// FAIL-CLOSED, unlike the owner-events writers: a query error or a timeout is treated as revoked.
// The row lookup it follows hits the same database, so a blip that fails this read would have
// failed the owner lookup too; a stale "not revoked" must never let a revoked session through.
// Stores and compares only sha256(token) — the raw token never leaves the request.
import { supabaseAdmin } from "@/lib/supabase";
import { tokenHash, logOwnerAuthEvent } from "@/lib/owner-events";

const REVOCATION_READ_TIMEOUT_MS = 3000;

export async function isOwnerSessionRevoked(token: string | null | undefined, slug?: string | null): Promise<boolean> {
  if (!token) return true;
  try {
    const res = await Promise.race([
      Promise.resolve(
        supabaseAdmin.from("owner_session_meta").select("revoked_at").eq("token_sha256", tokenHash(token)).maybeSingle(),
      ),
      new Promise<null>((r) => setTimeout(() => r(null), REVOCATION_READ_TIMEOUT_MS)),
    ]);
    if (!res || res.error) return true;                          // timeout / read error: fail closed
    const revoked = !!(res.data as { revoked_at?: string | null } | null)?.revoked_at;
    if (revoked) await logOwnerAuthEvent("session_refused", { slug: slug ?? null, detail: "revoked" });
    return revoked;
  } catch {
    return true;
  }
}

// Server-only owner secrets that must never reach a browser payload (props, RSC flight data,
// JSON). Owner pages receive listings through verifyOwnerAccess, which strips these.
export const OWNER_SECRET_COLUMNS = ["owner_auth_token", "owner_auth_token_expires_at"] as const;

export function withoutOwnerSecrets<T>(row: T): T {
  if (!row || typeof row !== "object") return row;
  const copy = { ...(row as Record<string, unknown>) };
  for (const c of OWNER_SECRET_COLUMNS) delete copy[c];
  return copy as T;
}
