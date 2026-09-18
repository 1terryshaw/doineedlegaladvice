import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LANE_SITE } from "@/lib/lane-gate";
import type { LaneCandidate } from "@/lib/lane-dedup";
import type { LaneSessionRow } from "@/lib/lane-session";

/**
 * THE LANE'S STORE (spec §9 — "BESPOKE: hospice speaks `pg`; DINLA speaks PostgREST").
 *
 * ── 🔴 THE LANE BUILDS ITS OWN CLIENT, AND DOES NOT IMPORT `lib/supabase.ts` ─────────
 * Same URL, same `SUPABASE_SERVICE_ROLE_KEY`, same `cache: "no-store"` fetch — no new env
 * var, no new credential, no second connection story. What is NOT imported is the
 * directory's module: `lib/supabase.ts` is the directory plane's data layer, it declares
 * `owner_auth_token` (line 124) in its listing type, and pulling it into the lane's import
 * closure would put the claim funnel's credential vocabulary one hop from every lane route.
 * PS-L1 asserts that closure is clean, and this is how it stays clean by construction rather
 * than by luck.
 *
 * ── THE TABLE NAMES APPEAR HERE AND ONLY HERE ───────────────────────────────────────
 * `legal_submitted_listing` and its two siblings are named in this module. 🔴 NO STATEMENT
 * IN THIS FILE — OR ANYWHERE IN THE REPO — MENTIONS BOTH A LANE TABLE AND `legal_listings`.
 * That is PS-L4, and it is the K38 guarantee in one assertion: a lane row and a roster row
 * can never be joined, merged, counted together or copied between. The finder is the only
 * thing here that reads the roster at all, and it does so through a SELECT-only database
 * function whose name mentions neither table.
 */

const LANE_TABLE = "legal_submitted_listing";
const LANE_HISTORY = "legal_submitted_listing_history";
const LANE_EMAIL_AUDIT = "legal_submitted_email_delivery";

/** PostgREST's code for "relation does not exist". Between deploy and migration, this is normal. */
export const MISSING_RELATION = "42P01";

export function isMissingRelation(error: { code?: string | null } | null | undefined): boolean {
  return (error?.code ?? "") === MISSING_RELATION;
}

let client: SupabaseClient | null = null;
export function laneDb(): SupabaseClient {
  if (client) return client;
  client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: "no-store" }) } },
  );
  return client;
}

/** Which site's rows this process serves. An E2E row carries `dinla-e2e` and can never render. */
export function laneSite(): string {
  return (process.env.LANE_SITE_OVERRIDE ?? LANE_SITE).trim() || LANE_SITE;
}

export interface LaneRow {
  submission_id: string;
  site: string;
  business_name: string;
  contact_name: string | null;
  address_line: string | null;
  city: string;
  region_state: string;
  postal_code: string | null;
  country: string;
  phone: string | null;
  website: string | null;
  public_email: string | null;
  description: string | null;
  submitted_by_email: string;
  submission_status: string;
  is_published: boolean;
  slug: string;
  verified_at: string | null;
  published_at: string | null;
  withdrawn_at: string | null;
}

// ── audit ────────────────────────────────────────────────────────────────────────────

/**
 * Append-only history. NEVER throws: an audit write that fails must not fail the action it
 * is auditing, or a transient audit fault becomes a user-visible 500 on a write that
 * already landed. It DOES log loudly — a refusal rate nobody can see is how a broken bot
 * check looks exactly like a quiet week.
 */
export async function laneHistory(entry: {
  submission_id: string;
  actor: string;
  action: string;
  from_status?: string | null;
  to_status?: string | null;
  from_published?: boolean | null;
  to_published?: boolean | null;
  detail?: string;
}): Promise<void> {
  try {
    const { error } = await laneDb().from(LANE_HISTORY).insert({
      submission_id: entry.submission_id,
      actor: entry.actor,
      action: entry.action,
      from_status: entry.from_status ?? null,
      to_status: entry.to_status ?? null,
      from_published: entry.from_published ?? null,
      to_published: entry.to_published ?? null,
      detail: entry.detail ?? "",
    });
    if (error) console.error("[lane] history insert failed:", error.message);
  } catch (e) {
    console.error("[lane] history insert threw:", e instanceof Error ? e.message : e);
  }
}

/** Audit of THAT a message was attempted. No body, no token, ever. */
export async function laneEmailAudit(entry: {
  submission_id: string;
  recipient: string;
  transport: string;
  purpose: string;
  accepted: boolean;
  provider_status: string;
}): Promise<void> {
  try {
    const { error } = await laneDb().from(LANE_EMAIL_AUDIT).insert({
      site: laneSite(),
      submission_id: entry.submission_id,
      recipient: entry.recipient,
      transport: entry.transport,
      purpose: entry.purpose,
      accepted: entry.accepted,
      provider_status: entry.provider_status.slice(0, 500),
    });
    if (error) console.error("[lane] email audit insert failed:", error.message);
  } catch (e) {
    console.error("[lane] email audit insert threw:", e instanceof Error ? e.message : e);
  }
}

// ── the rate limiter's counter and the advisory region probe ─────────────────────────

export async function recentSubmissionsFromIp(ip: string, windowHours: number): Promise<number> {
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const { count, error } = await laneDb()
    .from(LANE_TABLE)
    .select("submission_id", { count: "exact", head: true })
    .eq("site", laneSite())
    .eq("submitted_ip", ip)
    .gte("submitted_at", since);
  // A limiter that cannot count has not established the caller is under the limit. Throwing
  // is how `checkRateLimit` learns that; it converts the throw into RATE_LIMIT_UNAVAILABLE.
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function cityObserved(regionState: string, city: string): Promise<boolean> {
  const { count, error } = await laneDb()
    .from(LANE_TABLE)
    .select("submission_id", { count: "exact", head: true })
    .eq("site", laneSite())
    .eq("region_state", regionState)
    .ilike("city", city);
  if (error) return false;
  return (count ?? 0) > 0;
}

// ── the finder ───────────────────────────────────────────────────────────────────────

/**
 * Calls the lane's SELECT-only database function. `STABLE` means Postgres itself raises on
 * any write attempted inside it (PS-L8 lock 1), so this call cannot mutate anything whatever
 * the function body later grows into.
 */
export async function findLaneCandidates(input: {
  name: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  postal_code: string | null;
}): Promise<{ ok: true; rows: LaneCandidate[] } | { ok: false; code: string }> {
  const { data, error } = await laneDb().rpc("legal_lane_find_candidates", {
    p_name: input.name,
    p_phone: input.phone,
    p_website: input.website,
    p_address: input.address,
    p_postal_code: input.postal_code,
  });
  if (error) {
    console.error("[lane] finder failed:", error.code, error.message);
    return { ok: false, code: error.code ?? "FINDER_FAILED" };
  }
  return { ok: true, rows: (data ?? []) as LaneCandidate[] };
}

// ── the intake write ─────────────────────────────────────────────────────────────────

export async function insertSubmission(row: Record<string, unknown>): Promise<
  { ok: true; row: LaneRow } | { ok: false; code: string; message: string }
> {
  const { data, error } = await laneDb().from(LANE_TABLE).insert(row).select("*").single();
  if (error || !data) {
    return { ok: false, code: error?.code ?? "INSERT_FAILED", message: error?.message ?? "insert failed" };
  }
  return { ok: true, row: data as LaneRow };
}

// ── the render path ──────────────────────────────────────────────────────────────────

/**
 * The public page's read. 🔴 FILTERED ON `site`, which is what makes an E2E row unable to
 * render on production — the isolation is a column the schema already needs, not a promise.
 *
 * A MISSING RELATION IS A 404, NOT A 500 (§5.5). Between the deploy and the migration the
 * lane tables do not exist, and a public URL must not serve a stack trace.
 */
export async function publishedLaneRowBySlug(slug: string): Promise<LaneRow | null> {
  const { data, error } = await laneDb()
    .from(LANE_TABLE)
    .select("*")
    .eq("site", laneSite())
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error) {
    if (isMissingRelation(error)) {
      console.warn("[lane] listed page: lane relation absent — serving 404 (pre-migration)");
      return null;
    }
    console.error("[lane] listed page read failed:", error.code, error.message);
    return null;
  }
  return (data as LaneRow) ?? null;
}

/** The owner surface's read — NOT filtered on `is_published`: a withdrawn row's owner may still land. */
export async function laneRowBySlug(slug: string): Promise<LaneRow | null> {
  const { data, error } = await laneDb()
    .from(LANE_TABLE)
    .select("*")
    .eq("site", laneSite())
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    if (!isMissingRelation(error)) console.error("[lane] row read failed:", error.code, error.message);
    return null;
  }
  return (data as LaneRow) ?? null;
}

// ── verify ───────────────────────────────────────────────────────────────────────────

/** The interstitial's READ. Names the listing; writes nothing. */
export async function peekVerifyToken(digest: string): Promise<{ business_name: string; slug: string } | null> {
  const { data, error } = await laneDb()
    .from(LANE_TABLE)
    .select("business_name, slug")
    .eq("verify_token_sha256", digest)
    .gt("verify_token_expires_at", new Date().toISOString())
    .eq("submission_status", "pending_verification")
    .maybeSingle();
  if (error) return null;
  return (data as { business_name: string; slug: string }) ?? null;
}

/**
 * 🔴 CONSUME → VERIFY → PUBLISH, IN ONE STATEMENT (§4.1).
 *
 * `submission_status='verified'`, `verified_at`, `is_published=true` and `published_at` all
 * move together, so `lsl_publish_requires_verified` and `lsl_published_has_timestamp` can
 * never be transiently false. The token is nulled in the SAME statement, so a second consume
 * matches ZERO ROWS and returns 400 — the replay is not "detected", it is impossible.
 *
 * The session is minted here too: verifying the mailbox IS the proof of control, and a
 * second round-trip to establish it would be a second window in which the row is publishable
 * but unowned.
 */
export async function consumeVerifyAndPublish(input: {
  digest: string;
  sessionDigest: string;
  csrfDigest: string;
  sessionTtlHours: number;
}): Promise<LaneRow | null> {
  const now = new Date();
  const nowIso = now.toISOString();
  const { data, error } = await laneDb()
    .from(LANE_TABLE)
    .update({
      submission_status: "verified",
      verified_at: nowIso,
      is_published: true,
      published_at: nowIso,
      verify_token_sha256: null,
      verify_token_expires_at: null,
      owner_session_sha256: input.sessionDigest,
      owner_csrf_sha256: input.csrfDigest,
      owner_session_expires_at: new Date(now.getTime() + input.sessionTtlHours * 3600_000).toISOString(),
      owner_session_revoked_at: null,
      updated_at: nowIso,
    })
    .eq("verify_token_sha256", input.digest)
    .gt("verify_token_expires_at", nowIso)
    .eq("submission_status", "pending_verification")
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[lane] verify consume failed:", error.code, error.message);
    return null;
  }
  return (data as LaneRow) ?? null;
}

/** A failed consume bumps the counter WITHOUT touching the row's lifecycle. Best-effort. */
export async function bumpVerifyFailure(digest: string): Promise<void> {
  try {
    await laneDb().rpc("legal_lane_bump_verify_failure", { p_digest: digest });
  } catch {
    /* advisory only — a counter that cannot increment must not fail the refusal */
  }
}

/** `/resend`: re-mail the EXISTING live token. It never re-mints — see the route. */
export async function pendingRowByEmail(email: string): Promise<LaneRow | null> {
  const { data, error } = await laneDb()
    .from(LANE_TABLE)
    .select("*")
    .eq("site", laneSite())
    .eq("submitted_by_email", email)
    .eq("submission_status", "pending_verification")
    .gt("verify_token_expires_at", new Date().toISOString())
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data as LaneRow) ?? null;
}

// ── the owner surface ────────────────────────────────────────────────────────────────

export async function laneSessionByDigest(digest: string): Promise<LaneSessionRow | null> {
  const { data, error } = await laneDb()
    .from(LANE_TABLE)
    .select("submission_id, slug, owner_csrf_sha256, owner_session_expires_at, owner_session_revoked_at")
    .eq("owner_session_sha256", digest)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as {
    submission_id: string;
    slug: string;
    owner_csrf_sha256: string | null;
    owner_session_expires_at: string | null;
    owner_session_revoked_at: string | null;
  };
  return {
    submission_id: r.submission_id,
    slug: r.slug,
    owner_csrf_sha256: r.owner_csrf_sha256,
    revoked: r.owner_session_revoked_at !== null,
    expired: r.owner_session_expires_at === null || new Date(r.owner_session_expires_at) <= new Date(),
  };
}

/**
 * ALLOW-LISTED FIELD EDITS ONLY.
 *
 * 🔴 The allow-list is applied HERE, over the caller's already-validated object, and
 * `business_name` IS NOT ON IT. A forged `business_name` in the request body must not apply:
 * the name is the identity the submitter proved control of a mailbox for, and letting it be
 * rewritten later turns an owner session into a rename primitive. The donor plane's E2E
 * caught exactly this.
 */
export const OWNER_EDITABLE_FIELDS = [
  "contact_name", "address_line", "phone", "website", "public_email", "description",
] as const;

export async function ownerUpdateSubmission(
  submissionId: string,
  patch: Record<string, unknown>,
): Promise<LaneRow | null> {
  const clean: Record<string, unknown> = {};
  for (const f of OWNER_EDITABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, f)) clean[f] = patch[f];
  }
  if (Object.keys(clean).length === 0) return null;
  clean.updated_at = new Date().toISOString();
  const { data, error } = await laneDb()
    .from(LANE_TABLE)
    .update(clean)
    .eq("submission_id", submissionId)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[lane] owner update failed:", error.code, error.message);
    return null;
  }
  return (data as LaneRow) ?? null;
}

/**
 * WITHDRAWAL — unpublish, terminate, and REVOKE THE SESSION IN THE SAME STATEMENT (§7.3).
 * The page then 404s and the session no longer opens the dashboard: one statement, so there
 * is no window in which the row is withdrawn but the session still works.
 */
export async function withdrawSubmission(submissionId: string): Promise<LaneRow | null> {
  const nowIso = new Date().toISOString();
  const { data, error } = await laneDb()
    .from(LANE_TABLE)
    .update({
      is_published: false,
      submission_status: "withdrawn",
      withdrawn_at: nowIso,
      published_at: null,
      owner_session_revoked_at: nowIso,
      updated_at: nowIso,
    })
    .eq("submission_id", submissionId)
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[lane] withdraw failed:", error.code, error.message);
    return null;
  }
  return (data as LaneRow) ?? null;
}

/**
 * R-7b's ONE SANCTIONED BRIDGE (§7.4, PS-L6). `app/api/removal-request/route.ts` calls this
 * to resolve a lane slug so a third-party report names a real row. It RESOLVES ONLY — the
 * removal-request endpoint authenticates nobody and must never unpublish, or anyone can
 * delist any business: a denial of service wearing a safety feature's clothes.
 */
export async function resolveLaneSlugForReport(
  slug: string,
): Promise<{ submission_id: string; business_name: string } | null> {
  const { data, error } = await laneDb()
    .from(LANE_TABLE)
    .select("submission_id, business_name")
    .eq("site", laneSite())
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as { submission_id: string; business_name: string };
}
