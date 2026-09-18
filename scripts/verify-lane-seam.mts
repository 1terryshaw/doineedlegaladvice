/**
 * LANE-SEAM GATE — the self-submitted lane and the directory's licensed-attorney roster never
 * touch, and the proof is an IMPORT CLOSURE, not a grep.
 * (newbiz-submissions-dinla-lane-build-v1, spec §6. Ported from
 * `register-hospice-v1/scripts/verify-submitted-lane-seam.mts`, retargeted, +PS-L3b/L8/L9/L10.)
 *
 * ── WHAT THIS DEFENDS ────────────────────────────────────────────────────────────────
 * `legal_submitted_listing` exists so a self-submitted page can never acquire
 * licensed-attorney provenance. The table's SHAPE buys most of that — there is nowhere on the
 * row to put a licence, a bar admission, a source or a tier. This gate buys the rest, which
 * the shape cannot:
 *
 *   1. no lane code path writes `legal_listings` or mints a claim credential;
 *   2. no lane page renders the directory's own object (badge, card, health, enrichment, GBP);
 *   3. no directory code path has even HEARD of the lane table (the mirror);
 *   4. no SQL statement anywhere joins the two — the K38 guarantee in one assertion;
 *   5. the lane's robots directive is the ruled one;
 *   6. exactly one sanctioned bridge exists, and it is named;
 *   7. the CSRF secret is never sourced from the cookie it is checked against;
 *   8. the finder's access to `legal_listings` is SELECT-only, three independent locks;
 *   9. the OFF-LIMITS claim machinery is BYTE-IDENTICAL to the pre-change tag;
 *  10. the lane's sender constants have not drifted from the directory's own.
 *
 * ── WHY THE CLOSURE, AND NOT A GREP ──────────────────────────────────────────────────
 * TDL #1014's C3 is explicit: a `grep` for a token in a file passes while the SPECIFIC module
 * four imports down does the write. A route file will never itself contain
 * `UPDATE legal_listings`; the hazard is what it can REACH. So the walker resolves `@/` and
 * relative specifiers over `.ts/.tsx/.mts/index.ts` and collects static imports, side-effect
 * imports, `export … from`, AND `await import()` — this tree's idiom for lazily-loaded
 * modules, which a static-only walker would miss entirely.
 *
 * ── 🔴 THE TWO-PHASE CONTRACT ────────────────────────────────────────────────────────
 * Spec §8.5 requires every assertion and every red control green BEFORE the first route file
 * is written. But "a file that does not exist writes nothing" is VACUOUSLY true — a pass that
 * means nothing. So the gate is explicit about which phase it is in:
 *   - it always walks the lane's LIB modules, which DO exist in phase 1, so PS-L1/2/4/5 are
 *     substantive from the first run;
 *   - a missing entrypoint is REPORTED, never silently skipped;
 *   - `--require-routes` additionally demands that every entrypoint exists. Step 2 runs
 *     without it; step 3 onward runs WITH it, and that is what turns the vacuous case into a
 *     failure instead of a green tick.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const REQUIRE_ROUTES = process.argv.includes("--require-routes");
/** Step 5 onward: the INSTALLED finder must exist, not merely be checkable in principle. */
const REQUIRE_INSTALLED = process.argv.includes("--require-installed");

/**
 * 🔴 THE DML MATCHER, AS ONE CONSTANT.
 *
 * The first version of this was `/\b(INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM)\b/i` and it
 * COULD NOT MATCH `UPDATE legal_listings`: the alternative ends on a word character, so the
 * trailing `\b` demanded a non-word character immediately after it — the pattern only ever
 * fired on a one-letter table name. PS-L8 reported `dmlInBody=false` on a body containing a
 * real UPDATE, which is a false pass, and only the PS-L8r red control revealed it. That is
 * exactly what a red control is for.
 */
const SQL_DML = /(?:\bINSERT\s+INTO\b|\bUPDATE\s+["a-z_]|\bDELETE\s+FROM\b|\bMERGE\s+INTO\b|\bCOPY\s+["a-z_]|\bTRUNCATE\b)/i;
const PRE_TAG = process.env.LANE_PRE_TAG ?? "working-v-dinla-lane-pre";

const results: { name: string; ok: boolean; detail: string }[] = [];
const record = (name: string, ok: boolean, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ·  ${detail}` : ""}`);
};
const skip = (name: string, why: string) => console.log(`SKIP  ${name}  ·  ${why}`);

const ROOT = resolve(".");
const rel = (p: string) => relative(ROOT, p) || p;

/**
 * 🔴 STRIP COMMENTS BEFORE MATCHING — the negative gate must not trip on its own attestation.
 *
 * Every module in this lane DOCUMENTS, at length, which tables it must never touch:
 * `lib/lane-store.ts` explains why it does not import `lib/supabase.ts` and names
 * `owner_auth_token` in the course of explaining that it stays away from it. A raw-source
 * matcher reads those explanations as violations and reports the file that most carefully
 * avoids a table as the file that uses it
 * (`feedback_substring_grep_for_directive_matches_its_own_comment`,
 * `feedback_negative_gate_trips_on_own_attestation`).
 *
 * So the unit of judgement is ACTIVE CODE.
 */
const stripComments = (src: string): string =>
  src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1");

/** SQL comments are a different syntax, and the migrations are full of them. */
const stripSqlComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--.*$/gm, "");

// ── the matchers ───────────────────────────────────────────────────────────────────────
const BASE_ROW = "legal_listings";
/** The PostgREST write form: `from("legal_listings")` then a mutation, within a short window. */
const POSTGREST_WRITE = new RegExp(
  String.raw`from\(\s*["']${BASE_ROW}["']\s*\)[\s\S]{0,400}?\.(insert|update|upsert|delete)\(`,
);
/** The raw-SQL write form. `legal_listings_*` siblings share the prefix — match the WORD. */
const RAW_WRITE = new RegExp(
  String.raw`(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+${BASE_ROW}\b(?!_)`,
  "i",
);
const baseRowWrite = (src: string) => POSTGREST_WRITE.test(src) || RAW_WRITE.test(src);
/** The claim funnel's credential vocabulary. The lane mints none of it, at any depth. */
const CLAIM_CREDENTIAL = /\b(owner_auth_token|owner_auth_token_expires_at|claim_attribution|abuse_claim_verdict)\b/;
/** Any lane table — the `_history` / `_email_delivery` siblings included. */
const LANE_TABLE = /\blegal_submitted_[a-z_]+\b/;
/** The lane table proper, for the PS-L4 statement matcher. */
const LANE_TABLE_WORD = /\blegal_submitted_listing\b/;

// ── the walker ────────────────────────────────────────────────────────────────────────
const resolveSpecifier = (spec: string, fromFile: string): string | null => {
  let p: string;
  if (spec.startsWith("@/")) p = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) p = resolve(dirname(fromFile), spec);
  else return null; // a bare package specifier is not this tree's code
  for (const cand of [p, `${p}.ts`, `${p}.tsx`, `${p}.mts`, join(p, "index.ts")]) {
    if (existsSync(cand) && /\.(ts|tsx|mts)$/.test(cand)) return cand;
  }
  return null;
};

const closureCache = new Map<string, string[]>();
const importClosure = (entry: string): string[] => {
  const key = resolve(entry);
  const hit = closureCache.get(key);
  if (hit) return hit;
  const seen = new Set<string>();
  const queue = [key];
  while (queue.length) {
    const file = queue.shift()!;
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    const specs = [
      ...[...src.matchAll(/(?:^|\n)\s*(?:import|export)[\s\S]{0,200}?from\s+["']([^"']+)["']/g)].map((m) => m[1]!),
      ...[...src.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)].map((m) => m[1]!),
      ...[...src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]!),
    ];
    for (const spec of specs) {
      const r = resolveSpecifier(spec, file);
      if (r && !seen.has(r)) queue.push(r);
    }
  }
  const out = [...seen].sort();
  closureCache.set(key, out);
  return out;
};

// ── the entrypoint sets ───────────────────────────────────────────────────────────────
/** Lane ROUTES. Absent in phase 1; required under `--require-routes`. */
const LANE_ROUTES = [
  "app/api/list-your-business/route.ts",
  "app/api/list-your-business/resend/route.ts",
  "app/api/submitted/verify/route.ts",
  "app/api/owner/submitted/update/route.ts",
  "app/listed/[slug]/page.tsx",
  "app/owner/submitted/[slug]/page.tsx",
];
/** Lane LIB modules. Present from phase 1, which is what keeps the early run substantive. */
const LANE_LIBS = [
  "lib/lane-gate.ts", "lib/lane-store.ts", "lib/lane-region.ts", "lib/lane-dedup.ts",
  "lib/lane-email.ts", "lib/lane-render.ts", "lib/lane-session.ts", "lib/lane-slug.ts",
  "lib/lane-validate.ts", "lib/lane-ratelimit.ts", "lib/lane-crypto.ts",
];
const LANE_ENTRYPOINTS = [...LANE_ROUTES, ...LANE_LIBS];

/**
 * DIRECTORY entrypoints — the mirror side. All of these exist today.
 * `middleware.ts` is included deliberately: its matcher is `/directory/:path*` and it runs the
 * 410 de-serve gate. A lane URL under `/directory` would inherit that gate, which is exactly
 * why the lane lives at `/listed/*` and why `middleware.ts` needs no change (PS-L9).
 */
const DIRECTORY_ENTRYPOINTS = [
  "app/directory/[slug]/page.tsx",
  "app/[region]/page.tsx",
  "app/[region]/[city]/page.tsx",
  "app/sitemap.xml/route.ts",
  "app/sitemap/[id]/route.ts",
  "app/claim/page.tsx",
  "app/claim/[slug]/page.tsx",
  "app/api/claim/route.ts",
  "app/api/claim/verify/route.ts",
  "app/api/owner/update/route.ts",
  "app/api/owner/login/route.ts",
  "app/robots.ts",
  "app/page.tsx",
  "middleware.ts",
];

/** OFF LIMITS (Terry 2026-07-14) — byte-identical before and after this build. PS-L9. */
const FROZEN_FILES = [
  "middleware.ts",
  "lib/republish-guard.ts",
  "app/api/claim/route.ts",
  "app/api/claim/verify/route.ts",
  "components/TierBadge.tsx",
];

const present = (list: readonly string[]) => list.filter((p) => existsSync(p));
const missing = (list: readonly string[]) => list.filter((p) => !existsSync(p));

// ═══════════════════════════════════════════════════════════════════════════════════════
// PS-L0 — phase. Reports what exists; FAILS under --require-routes if a route is missing.
// ═══════════════════════════════════════════════════════════════════════════════════════
{
  const absentRoutes = missing(LANE_ROUTES);
  const absentLibs = missing(LANE_LIBS);
  const ok = absentLibs.length === 0 && (REQUIRE_ROUTES ? absentRoutes.length === 0 : true);
  record(
    `PS-L0 lane entrypoint inventory${REQUIRE_ROUTES ? " (routes REQUIRED)" : " (phase 1: libs only)"}`,
    ok,
    absentRoutes.length === 0 && absentLibs.length === 0
      ? `all ${LANE_ROUTES.length} routes + ${LANE_LIBS.length} libs present`
      : `${LANE_ROUTES.length - absentRoutes.length}/${LANE_ROUTES.length} routes · ` +
        `${LANE_LIBS.length - absentLibs.length}/${LANE_LIBS.length} libs · ` +
        `MISSING: ${[...absentRoutes, ...absentLibs].join(", ")}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PS-L1 — no lane code path writes legal_listings or mints a claim credential.
// ═══════════════════════════════════════════════════════════════════════════════════════
{
  const offenders: string[] = [];
  let visits = 0;
  const entries = present(LANE_ENTRYPOINTS);
  for (const entry of entries) {
    for (const file of importClosure(entry)) {
      visits += 1;
      const src = stripComments(readFileSync(file, "utf8"));
      if (baseRowWrite(src)) offenders.push(`${rel(file)} writes ${BASE_ROW} (from ${entry})`);
      if (CLAIM_CREDENTIAL.test(src)) offenders.push(`${rel(file)} touches a claim credential (from ${entry})`);
      if (/\.rpc\(\s*["']dedup_match["']/.test(src)) offenders.push(`${rel(file)} calls dedup_match (from ${entry})`);
    }
  }
  record(
    "PS-L1 nothing reachable from a lane entrypoint writes legal_listings, mints a claim credential, or calls dedup_match",
    offenders.length === 0,
    offenders.length
      ? [...new Set(offenders)].join(" · ")
      : `${visits} module-visits across ${entries.length} entrypoints · 0 offenders`,
  );

  // PS-L1r — RED CONTROL. The matcher must SEE a planted writer, and the fixture must be
  // OUTSIDE every lane closure. A detector that cannot see a planted writer cannot see a
  // regression.
  const fixture = "scripts/stubs/lane-seam-violator.ts";
  const src = existsSync(fixture) ? stripComments(readFileSync(fixture, "utf8")) : "";
  const detectedPostgrest = POSTGREST_WRITE.test(src);
  const detectedRaw = RAW_WRITE.test(src);
  const detectedCred = CLAIM_CREDENTIAL.test(src);
  const reachable = entries.some((e) => importClosure(e).includes(resolve(fixture)));
  record(
    "PS-L1r the matcher DETECTS a planted legal_listings writer (both forms) + a credential touch, and the fixture is outside every lane closure",
    detectedPostgrest && detectedRaw && detectedCred && !reachable,
    `postgrestWrite=${detectedPostgrest} rawWrite=${detectedRaw} credential=${detectedCred} reachableFromLane=${reachable}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PS-L2 — the lane renders its OWN object, never the directory's.
//
// The ban is SPLIT, and the split is a finding rather than a weakening:
//   PS-L2a  the directory's MODEL modules: no lane module imports them DIRECTLY.
//   PS-L2b  the directory's COMPONENTS + the GBP modules: banned across the WHOLE closure,
//           no exception, at any depth. These are true render surfaces and true Google
//           surfaces; there is no shared-hub excuse for either.
// ═══════════════════════════════════════════════════════════════════════════════════════
const DIRECTORY_MODEL_MODULES = [
  "lib/listing-extras.ts", "lib/listing-health.ts", "lib/knowledge.ts", "lib/tier-capabilities.ts",
  "lib/supabase.ts", "lib/seo.ts",
];
const DIRECTORY_COMPONENTS = [
  "components/TierBadge.tsx", "components/ListingCard.tsx", "components/ListingClaimCTA.tsx",
  "components/ReviewShowcase.tsx", "components/HealthScore.tsx", "components/EnrichmentBlock.tsx",
  "components/PublicGbpClaimSidecar.tsx",
  // §7.5 — zero Google/GBP. No lane module may reach a GBP resolver at any depth.
  "lib/gbp-url.ts", "lib/gbp-connector.ts",
];
{
  const bannedModels = new Set(DIRECTORY_MODEL_MODULES.map((m) => resolve(m)));
  const bannedComponents = new Set(DIRECTORY_COMPONENTS.map((m) => resolve(m)));
  const entries = present(LANE_ENTRYPOINTS);

  const directOffenders: string[] = [];
  for (const entry of entries) {
    const src = stripComments(readFileSync(entry, "utf8"));
    const specs = [
      ...[...src.matchAll(/(?:^|\n)\s*(?:import|export)[\s\S]{0,200}?from\s+["']([^"']+)["']/g)].map((m) => m[1]!),
      ...[...src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]!),
    ];
    for (const spec of specs) {
      const r = resolveSpecifier(spec, resolve(entry));
      if (r && bannedModels.has(r)) directOffenders.push(`${rel(r)} imported DIRECTLY by ${entry}`);
    }
  }
  const closureOffenders: string[] = [];
  for (const entry of entries) {
    for (const file of importClosure(entry)) {
      if (bannedComponents.has(file)) closureOffenders.push(`${rel(file)} (reachable from ${entry})`);
    }
  }
  const offenders = [...directOffenders, ...closureOffenders];
  record(
    "PS-L2 the lane renders its own object — no DIRECT import of the directory's model modules, and its components + the GBP modules are unreachable at ANY depth",
    offenders.length === 0,
    offenders.length
      ? [...new Set(offenders)].join(" · ")
      : `${DIRECTORY_MODEL_MODULES.length} model modules (direct-import ban) + ${DIRECTORY_COMPONENTS.length} components/GBP (closure ban) · 0 offenders across ${entries.length} entrypoints`,
  );

  // PS-L2r — RED CONTROL: a fixture importing TierBadge is detected at closure depth, a
  // fixture importing lib/supabase.ts is detected by the direct-import rule, and the operator
  // removal script is outside every `app/` closure (an operator tool reachable from a web
  // route IS a web surface).
  const fixture = "scripts/stubs/lane-seam-violator-render.ts";
  const fixtureSpecs = existsSync(fixture)
    ? [...stripComments(readFileSync(fixture, "utf8")).matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!)
    : [];
  const resolved = fixtureSpecs.map((s) => resolveSpecifier(s, resolve(fixture)));
  const catchesComponent = resolved.some((r) => r !== null && bannedComponents.has(r));
  const catchesModel = resolved.some((r) => r !== null && bannedModels.has(r));
  const operator = "scripts/lane-remove-submission.mts";
  const appEntries = present([...LANE_ROUTES, ...DIRECTORY_ENTRYPOINTS]);
  const operatorReachable =
    existsSync(operator) && appEntries.some((e) => importClosure(e).includes(resolve(operator)));
  record(
    "PS-L2r the walker DETECTS a fixture importing TierBadge AND one importing lib/supabase.ts, and lane-remove-submission.mts is outside every app/ closure",
    catchesComponent && catchesModel && !operatorReachable,
    `componentDetected=${catchesComponent} modelDetected=${catchesModel} operatorPresent=${existsSync(operator)} operatorReachableFromApp=${operatorReachable}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PS-L3 — THE MIRROR. No directory code path has even heard of the lane table.
//         This is the machine-checkable form of "the /claim finder never returns a lane row":
//         it converts today's happy accident into an enforced invariant.
// ═══════════════════════════════════════════════════════════════════════════════════════
{
  const offenders: string[] = [];
  let visits = 0;
  const entries = present(DIRECTORY_ENTRYPOINTS);
  for (const entry of entries) {
    for (const file of importClosure(entry)) {
      visits += 1;
      // 🔴 STRIPPED, for the same reason PS-L1 is. A directory entrypoint whose header comment
      // explains the lane in the course of explaining that it never touches it must not be
      // reported as a breach of the separation it documents.
      if (LANE_TABLE.test(stripComments(readFileSync(file, "utf8")))) {
        offenders.push(`${rel(file)} (from ${entry})`);
      }
    }
  }
  record(
    "PS-L3 no module reachable from a DIRECTORY entrypoint mentions a lane table",
    offenders.length === 0 && entries.length === DIRECTORY_ENTRYPOINTS.length,
    offenders.length
      ? [...new Set(offenders)].join(" · ")
      : `${visits} module-visits across ${entries.length}/${DIRECTORY_ENTRYPOINTS.length} directory entrypoints · 0 mentions`,
  );

  const fixture = "scripts/stubs/lane-seam-violator-directory.ts";
  const detected = existsSync(fixture) && LANE_TABLE.test(stripComments(readFileSync(fixture, "utf8")));
  const reachable = entries.some((e) => importClosure(e).includes(resolve(fixture)));
  record(
    "PS-L3r the matcher DETECTS a planted lane-table mention, and the fixture is outside every directory closure",
    detected && !reachable,
    `detected=${detected} reachableFromDirectory=${reachable}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PS-L3b — CROSS-REPO. freelawyeradvice's claim finder (`lib/supabase.ts :: getListingForClaim`)
// deliberately carries NO country predicate, so freelawyeradvice.ca/claim/<slug> resolves US
// rows. That is a deliberate, reasoned CONSENT-REACHABILITY decision and the lane neither
// widens it nor can: FLA's finder reads `legal_listings`; a lane row lives in a table FLA's
// repo has never heard of. This asserts it stays that way.
//
// A MISSING CLONE PRINTS `SKIP` LOUDLY — never a silent pass.
// ═══════════════════════════════════════════════════════════════════════════════════════
{
  const SIBLING = resolve(ROOT, "..", "freelawyeradvice");
  if (!existsSync(SIBLING)) {
    skip("PS-L3b cross-repo: freelawyeradvice contains 0 mentions of a lane table", `clone absent at ${SIBLING}`);
  } else {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        if (["node_modules", ".next", ".git", "evidence"].includes(name)) continue;
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx|mts|sql)$/.test(name) && LANE_TABLE.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(SIBLING);
    record(
      "PS-L3b cross-repo: freelawyeradvice contains 0 mentions of a lane table",
      hits.length === 0,
      hits.length ? hits.map((h) => relative(SIBLING, h)).join(" · ") : `${SIBLING} scanned · 0 mentions`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PS-L4 — 🔴 NO SQL STATEMENT ANYWHERE IN THE REPO MENTIONS BOTH TABLES.
//         Stated DIRECTLY rather than inferred from the import graph: a statement mentioning
//         both is a violation whatever it is doing and wherever it lives. THIS IS THE K38
//         GUARANTEE IN ONE ASSERTION.
// ═══════════════════════════════════════════════════════════════════════════════════════
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "vendor", "evidence", "recon", "supabase"]);
function walkSources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkSources(p, out);
    else if (/\.(ts|tsx|mts|sql|sh)$/.test(name)) out.push(p);
  }
  return out;
}

/**
 * Split a source file into candidate STATEMENTS. A whole FILE mentioning both tables is not a
 * violation, so the unit of judgement is the statement — and the cheap, reliable proxy for one
 * is a template literal, a quoted string, or (in a `.sql` file) a semicolon-delimited statement.
 */
function sqlLiterals(path: string, src: string): string[] {
  if (path.endsWith(".sql") || path.endsWith(".sh")) {
    // 🔴 COMMENTS FIRST, and SQL comments are `--`, not `//`. The migrations explain at length
    // that these two tables are never joined; an unstripped extractor reads that paragraph as
    // a statement joining them and fails the gate on its own documentation.
    return stripSqlComments(src).split(";");
  }
  const code = stripComments(src);
  return [
    // A template literal legitimately spans lines — that is how SQL is written in TS here.
    ...[...code.matchAll(/`([^`]*)`/g)].map((m) => m[1]!),
    // ⚠️ A quoted string does NOT span lines, and saying so is the whole fix. A class of
    // `[^"\\]` MATCHES NEWLINES: it opens at a `"` in code and runs greedily to a `"` many
    // lines later, swallowing prose that names both tables. Excluding newlines is what makes
    // "a quoted string" mean a quoted string.
    ...[...code.matchAll(/"((?:[^"\\\n]|\\.){20,})"/g)].map((m) => m[1]!),
    ...[...code.matchAll(/'((?:[^'\\\n]|\\.){20,})'/g)].map((m) => m[1]!),
  ];
}

const joinsBoth = (literal: string) =>
  LANE_TABLE_WORD.test(literal) && new RegExp(String.raw`\b${BASE_ROW}\b(?!_)`).test(literal);

{
  /**
   * 🔴 THE GUARD AND ITS FIXTURES ARE EXCLUDED FROM THE GUARD'S OWN SCAN, AND THAT IS THE
   * CORRECT SHAPE (`feedback_negative_gate_trips_on_own_attestation`).
   *
   * This file necessarily names both tables on one line: that IS its assertion label, and the
   * red-control fixture necessarily contains a real planted join. Neither is application code,
   * neither touches a database, and neither ships. Left in scope, the gate reports itself as
   * the violation it exists to detect — and the fix is to RENAME THE REPORT, never to blunt
   * the matcher, which is why the matcher above is untouched and PS-L4r still proves it fires.
   */
  const SELF = resolve("scripts/verify-lane-seam.mts");
  const files = walkSources(ROOT).filter(
    (f) => !f.startsWith(`${ROOT}/scripts/stubs/`) && f !== SELF,
  );
  const offenders: string[] = [];
  for (const f of files) {
    for (const lit of sqlLiterals(f, readFileSync(f, "utf8"))) {
      if (joinsBoth(lit)) { offenders.push(rel(f)); break; }
    }
  }
  record(
    `PS-L4 no SQL statement anywhere in the repo mentions both a lane table and ${BASE_ROW}`,
    offenders.length === 0,
    offenders.length ? [...new Set(offenders)].join(" · ") : `${files.length} source files scanned · 0 joining statements`,
  );

  const fixture = "scripts/stubs/lane-seam-violator-join.ts";
  const detected =
    existsSync(fixture) && sqlLiterals(fixture, readFileSync(fixture, "utf8")).some(joinsBoth);
  record(
    "PS-L4r the statement matcher DETECTS a planted join (and the fixtures dir is excluded from the scan)",
    detected,
    `detected=${detected} · fixtures dir excluded so the planted join can never fail PS-L4 itself`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PS-L5 — the lane's robots value is the RULED literal, asserted BY IMPORTING THE REAL
//         MODULE. A source regex passes on a comment that merely DESCRIBES the directive.
// ═══════════════════════════════════════════════════════════════════════════════════════
{
  const gate = "lib/lane-gate.ts";
  const mod = await import(resolve(gate));
  const robots = mod.LANE_ROBOTS as { index: unknown; follow: unknown };
  const literalCorrect = robots?.index === false && robots?.follow === true;

  // §3.6 — the lane's accent must not be the directory's primary or its CTA orange.
  const vertical = await import(resolve("lib/vertical.config.ts"));
  const primary = (vertical.default as { primaryColor: string; ctaColor: string }).primaryColor;
  const cta = (vertical.default as { primaryColor: string; ctaColor: string }).ctaColor;
  const accent = mod.LANE_ACCENT as string;
  const accentDistinct = accent !== primary && accent !== cta;

  const seoImporters: string[] = [];
  for (const entry of present(LANE_ENTRYPOINTS)) {
    for (const file of importClosure(entry)) {
      if (file === resolve("lib/seo.ts")) seoImporters.push(`${rel(file)} (from ${entry})`);
    }
  }
  record(
    "PS-L5 LANE_ROBOTS is exactly {index:false, follow:true}, the lane accent is not the directory's primary/CTA colour, and no lane module reaches lib/seo.ts",
    literalCorrect && accentDistinct && seoImporters.length === 0,
    `LANE_ROBOTS={index:${robots?.index}, follow:${robots?.follow}} · accent=${accent} primary=${primary} cta=${cta} · seoImporters=${seoImporters.length ? seoImporters.join(", ") : "none"}`,
  );

  // RED CONTROL — the detector must fire on the wrong value and on a planted seo import.
  const fixture = "scripts/stubs/lane-seam-violator-robots.ts";
  let wrongDetected = false;
  if (existsSync(fixture)) {
    const bad = await import(resolve(fixture));
    const badRobots = bad.LANE_ROBOTS as { index: unknown; follow: unknown };
    wrongDetected = !(badRobots?.index === false && badRobots?.follow === true);
  }
  const reachable = present(LANE_ENTRYPOINTS).some((e) => importClosure(e).includes(resolve(fixture)));
  record(
    "PS-L5r the value check FIRES on a planted wrong robots literal, and that fixture is outside every lane closure",
    wrongDetected && !reachable,
    `wrongValueDetected=${wrongDetected} reachableFromLane=${reachable}`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PS-L6 — THE BRIDGE IS EXACTLY ONE FILE, AND IT IS NAMED.
//
// R-7b requires a third-party "this isn't my business" path for lane rows. DINLA ALREADY has
// the endpoint: `app/api/removal-request/route.ts` is the shared empire-wide compliance
// intake. It is taught to resolve lane slugs — one added branch — and `/api/report` is NOT
// built. A bridge is only reviewable while there is one of it, so this pins the count at one.
//
// 🔴 THE TEST IS REACHABILITY, NOT THE TABLE NAME. The route imports a resolver; the table
// name lives one module down in `lib/lane-store.ts`. A name-based check on the bridge is the
// same mistake TDL #1014's C3 names — the file that does the thing is not the file that
// spells it.
//
// SCOPED TO SHIPPED CODE (`app/`, `lib/`, `components/`). A `scripts/verify-*.mts` naming a
// lane table is ASSERTING ABOUT it, not using it.
// ═══════════════════════════════════════════════════════════════════════════════════════
const SANCTIONED_BRIDGE = "app/api/removal-request/route.ts";
const LANE_OWN_FILES = [
  ...LANE_ROUTES,
  ...LANE_LIBS,
  "app/list-your-business/page.tsx",
  "app/list-your-business/sent/page.tsx",
  "app/submitted/verify/page.tsx",
  "components/SubmitListingForm.tsx",
  "components/LaneOwnerForm.tsx",
];
{
  const laneOwn = new Set(LANE_OWN_FILES.map((m) => resolve(m)));
  const laneStore = resolve("lib/lane-store.ts");
  const files = walkSources(ROOT).filter(
    (f) =>
      /\.(ts|tsx)$/.test(f) &&
      (f.startsWith(`${ROOT}/app/`) || f.startsWith(`${ROOT}/lib/`) || f.startsWith(`${ROOT}/components/`)) &&
      !laneOwn.has(f) &&
      f !== laneStore,
  );
  const bridges = files.filter((f) => importClosure(f).includes(laneStore)).map(rel).sort();
  record(
    `PS-L6 exactly one shipped module outside the lane can reach the lane's store, and it is ${SANCTIONED_BRIDGE}`,
    bridges.length === 1 && bridges[0] === SANCTIONED_BRIDGE,
    bridges.length === 0
      ? "NO bridge found — removal-request no longer reaches the lane store (R-7b regressed)"
      : `bridges=[${bridges.join(", ")}]`,
  );
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PS-L7 — THE CSRF SECRET IS NEVER SOURCED FROM THE COOKIE.
//
// A double-submit check works only because its two halves arrive over two channels an
// attacker cannot both control: the cookie the browser attaches automatically, and a field
// the page had to be READ to obtain. `authoriseLane(lookup, id, body.csrf ?? cookie(LANE_CSRF_COOKIE))`
// collapses that to ONE channel — with no `csrf` field the handler reads the secret from the
// cookie and compares it to the digest of the same cookie, and it always matches. That exact
// defect shipped on the donor plane; only an end-to-end probe caught it.
//
// A unit test could not see it: `authoriseLane()` is correct in isolation and the unit test
// hands it a presented value. The defect was entirely in WHERE the handler got that value, so
// the assertion belongs here, at the call site, as a source-level invariant.
// ═══════════════════════════════════════════════════════════════════════════════════════
{
  const route = "app/api/owner/submitted/update/route.ts";
  const src = existsSync(route) ? stripComments(readFileSync(route, "utf8")) : "";
  const call = src.match(/authoriseLane\([^)]*\)/s)?.[0] ?? "";
  const sourcesFromCookie = /LANE_CSRF_COOKIE/.test(call);
  const sourcesFromBody = /body\.csrf|csrfPresented/.test(call);
  const ok = REQUIRE_ROUTES
    ? call !== "" && sourcesFromBody && !sourcesFromCookie
    : call === "" || (sourcesFromBody && !sourcesFromCookie);
  record(
    "PS-L7 the lane's CSRF secret is read from the request BODY only — never from the cookie it is checked against",
    ok,
    call === ""
      ? `no authoriseLane() call found in ${route}${REQUIRE_ROUTES ? " (REQUIRED)" : " (phase 1: route not yet written)"}`
      : `call=${call.replace(/\s+/g, " ")}`,
  );
  const defective = "authoriseLane(lookup, lookup.submissionId, body.csrf ?? cookie(LANE_CSRF_COOKIE))";
  const detected = /LANE_CSRF_COOKIE/.test(defective.match(/authoriseLane\([^)]*\)/s)?.[0] ?? "");
  record("PS-L7r the detector FIRES on the exact defective call this replaced (red control)", detected, `defective form detected=${detected}`);
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PS-L8 — 🔴 THE FINDER'S legal_listings ACCESS IS SELECT-ONLY. THREE INDEPENDENT LOCKS.
//   1. STABLE — Postgres itself raises on any write attempted inside the function.
//   2. no DML in the function body (comments stripped first).
//   3. no PostgREST mutation against legal_listings anywhere in the lane's import closure
//      (that is PS-L1, re-asserted here as the third lock of this specific property).
//
// Locks 1+2 are asserted from the MIGRATION SOURCE here, and re-asserted against the INSTALLED
// `pg_proc` row when DATABASE_URL is present (step 5 onward) — because a repo file may drift
// from what is installed, and a gate that can only read the repo must say so rather than
// imply it checked the database.
// ═══════════════════════════════════════════════════════════════════════════════════════
{
  const finderSql = "migrations/2026-09-18_legal_lane_finder.sql";
  const src = existsSync(finderSql) ? stripSqlComments(readFileSync(finderSql, "utf8")) : "";
  const declaresStable = /\bSTABLE\b/.test(src);
  const hasDml = SQL_DML.test(src);
  const grantsServiceRoleOnly = /REVOKE\s+ALL\s+ON\s+FUNCTION\s+legal_lane_find_candidates[\s\S]{0,200}?FROM\s+PUBLIC,\s*anon,\s*authenticated/i.test(src);
  record(
    "PS-L8 (repo) the finder declares STABLE, its body contains no DML, and it is revoked from PUBLIC/anon/authenticated",
    src !== "" && declaresStable && !hasDml && grantsServiceRoleOnly,
    `present=${src !== ""} STABLE=${declaresStable} dmlInBody=${hasDml} revoked=${grantsServiceRoleOnly}`,
  );
  // RED CONTROL — the DML matcher must fire on a VOLATILE variant carrying a write.
  const badFixture = "scripts/stubs/lane-finder-volatile.sql";
  const bad = existsSync(badFixture) ? stripSqlComments(readFileSync(badFixture, "utf8")) : "";
  const badDetected =
    bad !== "" &&
    /\bVOLATILE\b/.test(bad) &&
    SQL_DML.test(bad);
  record(
    "PS-L8r the detector FIRES on a VOLATILE finder variant carrying a write (red control)",
    badDetected,
    `volatileWriterDetected=${badDetected}`,
  );
  if (!process.env.DATABASE_URL) {
    skip("PS-L8 (installed) pg_proc.provolatile='s' and prosrc has no DML", "DATABASE_URL absent — the INSTALLED function was NOT checked");
  } else {
    try {
      const out = execFileSync(
        "psql",
        [process.env.DATABASE_URL, "-tAc",
         "select provolatile, prosecdef, replace(prosrc, E'\\n', ' ') from pg_proc where proname='legal_lane_find_candidates'"],
        { encoding: "utf8" },
      ).trim();
      if (out === "" && !REQUIRE_INSTALLED) {
        skip(
          "PS-L8 (installed) pg_proc.provolatile='s' and prosrc has no DML",
          "the finder is not installed yet — §8.5 applies the migration at step 5, AFTER the read path deploys. Re-run with --require-installed from there.",
        );
      } else if (out === "") {
        record("PS-L8 (installed) the finder exists, is STABLE, is SECURITY INVOKER, and its prosrc has no DML", false, "function NOT INSTALLED and --require-installed was passed");
      } else {
        const [vol, secdef, ...rest] = out.split("|");
        const body = stripSqlComments(rest.join("|"));
        const dml = SQL_DML.test(body);
        record(
          "PS-L8 (installed) the finder exists, is STABLE, is SECURITY INVOKER, and its prosrc has no DML",
          vol === "s" && secdef === "f" && !dml,
          `provolatile=${vol} prosecdef=${secdef} dmlInProsrc=${dml}`,
        );
      }
    } catch (e) {
      record("PS-L8 (installed) the finder exists, is STABLE, is SECURITY INVOKER, and its prosrc has no DML", false, `psql failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PS-L9 — 🔴 THE OFF-LIMITS CLAIM MACHINERY IS BYTE-IDENTICAL TO THE PRE-CHANGE TAG.
//
// `feedback_do_not_touch_claim_machinery` (Terry, 2026-07-14) puts `/api/claim`,
// `/api/claim/verify` and the badge ladder off limits: "no refactors, no while-we're-in-here,
// no drive-by fixes… The republish gap is LOGGED, NOT FIXED." This assertion is that
// constraint made MACHINE-CHECKED rather than remembered — and R-0 was ruled (a), THE HOLD
// STANDS, so the #1068 republish flip is NOT ported and these files do not move by one byte.
// ═══════════════════════════════════════════════════════════════════════════════════════
{
  const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
  const drift: string[] = [];
  let compared = 0;
  let tagPresent = true;
  try {
    execFileSync("git", ["rev-parse", "--verify", `${PRE_TAG}^{commit}`], { encoding: "utf8", stdio: "pipe" });
  } catch {
    tagPresent = false;
  }
  if (!tagPresent) {
    record("PS-L9 the OFF-LIMITS claim machinery is byte-identical to the pre-change tag", false, `tag ${PRE_TAG} not found — the invariant CANNOT be checked, which is a FAIL, not a skip`);
  } else {
    for (const f of FROZEN_FILES) {
      const before = execFileSync("git", ["show", `${PRE_TAG}:${f}`], { encoding: "buffer" });
      const now = readFileSync(f);
      compared += 1;
      if (sha(before) !== sha(now)) drift.push(`${f} (${sha(before).slice(0, 12)} → ${sha(now).slice(0, 12)})`);
    }
    record(
      "PS-L9 the OFF-LIMITS claim machinery is byte-identical to the pre-change tag",
      drift.length === 0,
      drift.length ? drift.join(" · ") : `${compared}/${FROZEN_FILES.length} files byte-identical to ${PRE_TAG}`,
    );
    // RED CONTROL — the comparator must detect a one-byte change. Proven on a COPY, in memory:
    // planting a real byte in a frozen file to test the guard would be the very edit it forbids.
    const sample = readFileSync(FROZEN_FILES[0]!);
    const mutated = Buffer.concat([sample, Buffer.from(" ")]);
    record(
      "PS-L9r the byte comparator DETECTS a one-byte change (proven on an in-memory copy, never by editing a frozen file)",
      sha(sample) !== sha(mutated),
      `sha(original)!=sha(original+1byte) = ${sha(sample) !== sha(mutated)}`,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// PS-L10 — the lane's sender constants have NOT drifted from the directory's own.
//
// `lib/lane-email.ts` re-declares `FROM_ADDRESS` and `AUTH_FROM` because `lib/resend.ts` does
// not export them and the lane does not edit shared fleet files to get at a constant. A
// duplicated constant is free to drift, so the duplication is machine-checked instead of
// trusted. §5.4: NO new sender, NO new domain, NO new env var.
// ═══════════════════════════════════════════════════════════════════════════════════════
{
  const resendSrc = readFileSync("lib/resend.ts", "utf8");
  const laneSrc = readFileSync("lib/lane-email.ts", "utf8");
  const from = resendSrc.match(/const FROM_ADDRESS\s*=\s*"([^"]+)"/)?.[1] ?? "";
  const auth = resendSrc.match(/const AUTH_FROM\s*=\s*`([^`]+)`/)?.[1] ?? "";
  const laneFrom = laneSrc.match(/export const LANE_FROM_ADDRESS\s*=\s*"([^"]+)"/)?.[1] ?? "";
  const laneAuth = laneSrc.match(/export const LANE_AUTH_FROM\s*=\s*`([^`]+)`/)?.[1] ?? "";
  // 🔴 STRIPPED. `lib/lane-email.ts` documents, in prose, that the register plane's
  // REGISTRY_EMAIL_* does not exist here and is never reached for. Read raw, that sentence IS
  // the violation. Third occurrence of the same trap in this one file
  // (`feedback_negative_gate_trips_on_own_attestation`) — active code is the unit of judgement.
  const noRegistryEnv = !/REGISTRY_EMAIL_/.test(stripComments(laneSrc));
  record(
    "PS-L10 the lane's senders are the directory's own constants, unchanged, and no REGISTRY_EMAIL_* is reached for",
    from !== "" && auth !== "" && from === laneFrom && auth === laneAuth && noRegistryEnv,
    `FROM_ADDRESS match=${from === laneFrom} AUTH_FROM match=${auth === laneAuth} registryEnvAbsent=${noRegistryEnv}`,
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\nLANE-SEAM: ${results.length - failed.length} pass, ${failed.length} fail${REQUIRE_ROUTES ? " (routes required)" : " (phase 1)"}`);
if (failed.length) console.error(`\nFAILED: ${failed.map((f) => f.name).join(" · ")}`);
process.exit(failed.length === 0 ? 0 : 1);
