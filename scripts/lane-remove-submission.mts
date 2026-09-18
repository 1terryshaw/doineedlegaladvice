/**
 * OPERATOR REMOVAL — the lane's only unpublish-by-a-third-party path (spec §7.4).
 *
 * 🔴 IT IS REACHABLE FROM NOWHERE UNDER `app/`. PS-L2r asserts that, and the reason is not
 * fastidiousness: an operator tool reachable from a web route IS a web surface.
 *
 * `app/api/removal-request/route.ts` DELIVERS A REPORT AND REMOVES NOTHING. An endpoint that
 * authenticates nobody must never unpublish, or anyone can delist any business — a denial of
 * service wearing a safety feature's clothes. Actual removal is this script, run by a human
 * who has read the report.
 *
 *   npx tsx scripts/lane-remove-submission.mts <slug> "<reason>" [--apply]
 *
 * Without `--apply` it prints what it would do and writes nothing.
 */
import { createClient } from "@supabase/supabase-js";

const [, , slug, reason, ...flags] = process.argv;
const APPLY = flags.includes("--apply");

if (!slug || !reason) {
  console.error('usage: lane-remove-submission.mts <slug> "<reason>" [--apply]');
  process.exit(2);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const TABLE = "legal_submitted_listing";

const { data: row, error } = await db.from(TABLE).select("*").eq("slug", slug).maybeSingle();
if (error) { console.error("read failed:", error.message); process.exit(1); }
if (!row) { console.error(`no lane row with slug ${slug}`); process.exit(1); }

console.log(`slug=${row.slug} site=${row.site} status=${row.submission_status} published=${row.is_published}`);
if (!APPLY) { console.log("DRY RUN — pass --apply to remove."); process.exit(0); }

const nowIso = new Date().toISOString();
const { error: upErr } = await db
  .from(TABLE)
  .update({
    is_published: false,
    submission_status: "removed",
    removed_reason: reason.slice(0, 500),
    published_at: null,
    // The session dies with the listing, in the same statement — otherwise the owner keeps a
    // working dashboard for a row an operator has removed.
    owner_session_revoked_at: nowIso,
    updated_at: nowIso,
  })
  .eq("submission_id", row.submission_id);
if (upErr) { console.error("remove failed:", upErr.message); process.exit(1); }

await db.from("legal_submitted_listing_history").insert({
  submission_id: row.submission_id,
  actor: `operator:${process.env.USER ?? "unknown"}`,
  action: "removed",
  from_status: row.submission_status,
  to_status: "removed",
  from_published: row.is_published,
  to_published: false,
  detail: reason.slice(0, 500),
});
console.log(`REMOVED ${slug}`);
