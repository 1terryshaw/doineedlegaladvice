import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, LISTINGS_TABLE } from "@/lib/supabase";
import { sendMagicLink } from "@/lib/email";
import { generateToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALERT_MODULE = "owner-login";
const ALERT_REPO = "doineedlegaladvice";

/**
 * Owner login — magic-link request. (TDL #1176 / #1177)
 *
 * TWO FIXES, 2026-07-24. Nothing else in the claim machinery is touched.
 *
 * 1. MINT-ON-NULL. This route used to LOOK UP owner_auth_token and mail a link built on
 *    whatever it found — including `null`. 19 claimed owners across 12 verticals hold
 *    owner_email with a NULL token, so they received a magic link with `token=null` that
 *    verifyOwnerAccess could never validate: a permanent, silent lockout. Now a NULL or
 *    EXPIRED token is MINTED, persisted, and mailed. A token that is present and unexpired
 *    is REUSED with no write at all, so live sessions survive untouched.
 *
 *    Token contract matches /api/claim exactly (read it before changing this): randomUUID()
 *    via generateToken(), and owner_auth_token_expires_at set to NULL — /api/claim/verify
 *    treats NULL as "never expires". Clearing it on mint is REQUIRED, not cosmetic: on an
 *    expired row a stale past expiry would otherwise reject the freshly-minted token at
 *    verify and reproduce the lockout we are fixing.
 *
 * 2. THE SWALLOW, BRANCHED. Every PostgREST error used to fall into the anti-enumeration
 *    `return {success:true}`, so a column rename or a broken query would kill login for an
 *    ENTIRE vertical while telling every owner "check your email" and logging nothing.
 *    The caller still always gets {success:true} — enumeration resistance is unchanged —
 *    but internally "no matching listing" (normal) and "the query errored" (never normal)
 *    are now different branches. The latter logs loudly and writes sentinel_alerts, same
 *    shape as the places-key-health monitor.
 *
 * The listing fetch uses select("*") DELIBERATELY — the listings tables are not
 * column-uniform and an enumerated select 404s/errors on a table missing a column
 * (TDL #1175). Do not "optimize" it.
 *
 * .limit(1) replaces .single(): .single() raises PGRST116 when an owner has TWO claimed
 * listings, which the old code swallowed as "not found" — i.e. a multi-listing owner could
 * never log in. Zero rows is now an empty array (normal), and only a REAL query failure
 * populates `error`. That separation is what makes the alert branch trustworthy.
 */

/** Best-effort operator alert. Never throws, never blocks the response, never logs the raw email. */
async function alertQueryFailure(title: string, details: Record<string, unknown>) {
  try {
    const { error } = await supabaseAdmin.from("sentinel_alerts").insert({
      severity: "high",
      module: ALERT_MODULE,
      repo: ALERT_REPO,
      title,
      details,
      status: "open",
    });
    if (error) console.error(`[owner/login] sentinel_alerts insert failed: ${error.message}`);
  } catch (e) {
    console.error(`[owner/login] sentinel_alerts insert threw: ${e instanceof Error ? e.message : e}`);
  }
}

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const emailRedacted = String(email).replace(/(.{2}).+(@.+)/, "$1***$2");

  // Case-INSENSITIVE match (2026-07-24). Same silent-lockout class as the two fixes above:
  // claimed as "John@x.com", types "john@x.com", gets "check your email" forever and nothing
  // errors. `.eq` is case-sensitive; dentist already uses `.ilike`.
  //
  // Wildcards are ESCAPED first — this is the one place this route diverges from dentist, and
  // deliberately. Under ILIKE, `%` and `_` are wildcards, and `_` is COMMON in real addresses:
  // an unescaped `john_smith@x.com` would also match `johnXsmith@x.com`, i.e. hand a different
  // owner's listing to whoever typed it. Escaping keeps this an exact match that merely ignores
  // case. (PostgREST also maps `*` to `%`, so it is escaped too.)
  const emailPattern = String(email).replace(/([\\%_*])/g, "\\$1");

  const { data: rows, error } = await supabaseAdmin
    .from(LISTINGS_TABLE)
    .select("*")
    .ilike("owner_email", emailPattern)
    .eq("claimed", true)
    .limit(1);

  // --- the swallow, branched: a query FAILURE is never normal ---
  if (error) {
    console.error(
      JSON.stringify({
        event: "owner_login_query_error",
        email_redacted: emailRedacted,
        table: LISTINGS_TABLE,
        err: error.message,
      })
    );
    await alertQueryFailure(`Owner login query failed on ${LISTINGS_TABLE}`, {
      table: LISTINGS_TABLE,
      error: error.message,
      code: (error as { code?: string }).code ?? null,
      impact: "owner login is silently dead for this vertical — every caller still sees success",
      email_redacted: emailRedacted,
    });
    // Anti-enumeration: the caller must not be able to tell this apart from "no such owner".
    return NextResponse.json({ success: true });
  }

  const listing = rows?.[0];
  if (!listing) {
    // Normal: no claimed listing for this email. Not an error, no alert.
    return NextResponse.json({ success: true });
  }

  // --- mint on NULL or EXPIRED; reuse (no write) when present and valid ---
  let token: string = listing.owner_auth_token as string;
  const expiresAt = listing.owner_auth_token_expires_at as string | null;
  const isExpired = !!expiresAt && new Date(expiresAt).getTime() < Date.now();

  if (!token || isExpired) {
    const minted = generateToken();
    // expires_at MUST be cleared alongside the mint — see the header note.
    const { error: mintErr, count } = await supabaseAdmin
      .from(LISTINGS_TABLE)
      .update({ owner_auth_token: minted, owner_auth_token_expires_at: null }, { count: "exact" })
      .eq("id", listing.id);

    // FAIL-CLOSED: never mail a link for a token we did not persist. supabase-js RETURNS
    // { error } and a zero-row UPDATE returns no error at all, so both are checked (K36).
    if (mintErr || (count ?? 0) === 0) {
      const why = mintErr ? mintErr.message : "update matched 0 rows";
      console.error(
        JSON.stringify({
          event: "owner_login_mint_failed",
          email_redacted: emailRedacted,
          slug: listing.slug,
          err: why,
        })
      );
      await alertQueryFailure(`Owner login token mint failed on ${LISTINGS_TABLE}`, {
        table: LISTINGS_TABLE,
        slug: listing.slug,
        error: why,
        impact: "owner cannot log in; no link was sent",
        email_redacted: emailRedacted,
      });
      return NextResponse.json({ success: true });
    }

    token = minted;
    console.log(
      JSON.stringify({
        event: "owner_login_token_minted",
        email_redacted: emailRedacted,
        slug: listing.slug,
        reason: isExpired ? "expired" : "null",
      })
    );
  }

  try {
    const result = await sendMagicLink(email, listing.slug, token);
    if (result.ok) {
      console.log(
        JSON.stringify({
          event: "owner_login_send_ok",
          email_redacted: emailRedacted,
          slug: listing.slug,
          resend_id: result.id,
        })
      );
    } else {
      console.error(
        JSON.stringify({
          event: "owner_login_send_error",
          email_redacted: emailRedacted,
          slug: listing.slug,
          err: result.error,
        })
      );
    }
  } catch (err) {
    console.error(
      JSON.stringify({
        event: "owner_login_send_error",
        email_redacted: emailRedacted,
        slug: listing.slug,
        err: String(err),
      })
    );
  }
  // Anti-enumeration: behavior to the user is unchanged regardless of send outcome.
  return NextResponse.json({ success: true });
}
