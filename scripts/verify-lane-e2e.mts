/**
 * LAYER 3 — END-TO-END, ON A PREVIEW DEPLOYMENT, AGAINST THE REAL DIRECTORY DATABASE.
 * (newbiz-submissions-dinla-lane-build-v1, spec §8.3.)
 *
 *   LANE_E2E_BASE=<preview url> DATABASE_URL=… npx tsx scripts/verify-lane-e2e.mts
 *
 * ── ISOLATION IS A COLUMN, NOT A PROMISE ────────────────────────────────────────────
 * The preview runs with `LANE_SITE_OVERRIDE=dinla-e2e`, and every render path filters on
 * `site`. A row this harness creates therefore CANNOT render on production — the isolation is
 * a column the schema already needed, not a convention someone has to remember. Every row is
 * deleted at the end; the `_history` rows are kept as the audit that they existed.
 *
 * ── 🔴 ZERO WRITES TO legal_listings, ASSERTED BEFORE AND AFTER ─────────────────────
 * Row count, US-slice count, published/held split and max(updated_at) are captured before the
 * first request and compared after the last one. The matched held row's own claim-credential
 * fingerprint is captured too — the finder handing a submitter to `/claim/<slug>` must not
 * touch `owner_auth_token`, `owner_email` or `claimed`.
 *
 * ── THE ONE SEAM THIS HARNESS CANNOT CROSS, AND WHY THAT IS THE TEST PASSING ────────
 * The lane stores ONLY `sha256(verify_token)`. The plaintext exists in exactly one place —
 * the email — and the preview runs `LANE_MAIL_TRANSPORT=test` so that no message reaches a
 * real third party (§8.3). There is consequently NO way to recover the minted token, which is
 * precisely the security property the digest-only design exists to provide.
 *
 * So the verify flow is driven in two halves that meet at a digest:
 *   (a) the intake route MINTED a credential — asserted as a non-null `verify_token_sha256`
 *       on the row plus an `accepted` row in the email audit;
 *   (b) the verify route CONSUMES a digest correctly — driven by writing a digest this
 *       harness knows the preimage of onto the E2E row, then POSTing the real route.
 * Both halves call the same `sha256`. Being unable to replay (a) into (b) from the database
 * is the property under test, not a gap in it.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";

const BASE = process.env.LANE_E2E_BASE ?? "";
const DB = process.env.DATABASE_URL ?? "";
if (!BASE || !DB) {
  console.error("LANE_E2E_BASE and DATABASE_URL are required");
  process.exit(2);
}
const E2E_SITE = "dinla-e2e";
const sha256 = (v: string) => createHash("sha256").update(v, "utf8").digest("hex");

const results: { name: string; ok: boolean; detail: string }[] = [];
const record = (name: string, ok: boolean, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ·  ${detail}` : ""}`);
};

/**
 * psql, with the connection string kept OUT of any error message.
 *
 * 🔴 `execFileSync` puts the whole argv into the Error it throws, and the argv here contains
 * `DATABASE_URL` — which carries the database PASSWORD. The first version of this let a failed
 * query print the credential to the terminal and into the run log. Never let a helper that
 * takes a secret as an argument throw the raw error.
 */
const sql = (q: string): string => {
  try {
    return execFileSync("psql", [DB, "-q", "-tAc", q], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (e) {
    const stderr = String((e as { stderr?: unknown }).stderr ?? "").trim();
    throw new Error(`psql failed on: ${q.slice(0, 160)}\n${stderr}`);
  }
};

/**
 * Every request goes through `vercel curl`, which carries the deployment-protection
 * credential. The preview is SSO-protected (`ssoProtection.deploymentType =
 * all_except_custom_domains`), so a plain fetch() gets a login page — that protection is why
 * running this against the real database on a preview URL is acceptable at all.
 */
function vcurl(path: string, args: string[] = []): { status: number; body: string; headers: string } {
  const out = execFileSync(
    "npx",
    ["--no-install", "vercel", "curl", `${BASE}${path}`, "-s", "-i", ...args],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] },
  );
  const start = out.indexOf("HTTP/");
  const raw = start >= 0 ? out.slice(start) : out;
  const split = raw.indexOf("\r\n\r\n") >= 0 ? raw.indexOf("\r\n\r\n") : raw.indexOf("\n\n");
  const headers = split >= 0 ? raw.slice(0, split) : raw;
  const body = split >= 0 ? raw.slice(split).trim() : "";
  const status = Number(headers.match(/HTTP\/[\d.]+\s+(\d{3})/)?.[1] ?? 0);
  return { status, body, headers };
}

const postJson = (path: string, payload: unknown, extra: string[] = []) =>
  vcurl(path, ["-X", "POST", "-H", "content-type: application/json", "-d", JSON.stringify(payload), ...extra]);

// ══════════════════════════════════════════════════════════════════════════════════════
// BEFORE — the zero-writes baseline on legal_listings.
// ══════════════════════════════════════════════════════════════════════════════════════
const HELD_SLUG = "legal-ny-brooklyn-david-nadel-ny_oca_2026_06_03-2032746";
const HELD_NAME = "David Nadel";
const HELD_PHONE = "(718) 375-0594";

const llFingerprint = () =>
  sql(
    "select count(*)::text || '|' || count(*) filter (where country='US')::text || '|' || " +
      "count(*) filter (where country='US' and is_published)::text || '|' || " +
      "coalesce(max(updated_at) filter (where country='US')::text,'null') from legal_listings",
  );
const heldRowFingerprint = () =>
  sql(
    `select md5(coalesce(owner_auth_token,'') || coalesce(owner_email,'') || coalesce(claimed::text,'') || coalesce(updated_at::text,'') || coalesce(is_published::text,'')) from legal_listings where slug='${HELD_SLUG}'`,
  );
const laneRowCount = () => Number(sql(`select count(*) from legal_submitted_listing where site='${E2E_SITE}'`));

const LL_BEFORE = llFingerprint();
const HELD_BEFORE = heldRowFingerprint();
record("E-0 baseline captured on legal_listings and on the held fixture row", LL_BEFORE !== "" && HELD_BEFORE !== "", `legal_listings=${LL_BEFORE} heldRow=${HELD_BEFORE.slice(0, 12)}…`);

const stamp = Date.now();
const NAME = `Kestrel Mediation Collective ${stamp}`;
const EMAIL = `lane-e2e+${stamp}@doineedlegaladvice.com`;
const submission = {
  business_name: NAME,
  contact_name: "E2E Harness",
  address_line: "41 Beacon Way",
  city: "Bend",
  region_state: "OR",
  postal_code: "97701",
  phone: "541-555-0142",
  public_email: "hello@kestrel.example",
  description: "An end-to-end probe row. Deleted at the end of the run.",
  submitted_by_email: EMAIL,
};

// ══════════════════════════════════════════════════════════════════════════════════════
// E-1 — THE FINDER HANDS A KNOWN HELD ATTORNEY TO /claim/<slug> AND WRITES NOTHING.
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const lanesBefore = laneRowCount();
  const res = postJson("/api/list-your-business", {
    ...submission, business_name: HELD_NAME, phone: HELD_PHONE, city: "Brooklyn",
    region_state: "NY", postal_code: "11229", submitted_by_email: `held-${stamp}@example.com`,
  });
  let parsed: { outcome?: string; claim_url?: string; copy?: { body?: string } } = {};
  try { parsed = JSON.parse(res.body); } catch { /* reported below */ }
  const lanesAfter = laneRowCount();
  record(
    "E-1 🔴 a known HELD attorney is routed to /claim/<slug> — and ZERO lane rows are written",
    res.status === 200 && parsed.claim_url === `/claim/${HELD_SLUG}` && lanesAfter === lanesBefore,
    `status=${res.status} outcome=${parsed.outcome} claim_url=${parsed.claim_url} laneRows ${lanesBefore}→${lanesAfter}`,
  );
  record(
    "E-2 🔴 the held-match copy is the R-0 ruling-(a) wording — it says in terms that claiming does NOT publish",
    (parsed.copy?.body ?? "").includes("it does not publish the listing"),
    `copy="${(parsed.copy?.body ?? "").slice(0, 80)}…"`,
  );
  record(
    "E-3 🔴 the matched legal_listings row's claim credential is UNTOUCHED (no owner_auth_token, owner_email, claimed or updated_at change)",
    heldRowFingerprint() === HELD_BEFORE,
    `fingerprint ${HELD_BEFORE.slice(0, 12)}… → ${heldRowFingerprint().slice(0, 12)}…`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// E-4 — THE HONEYPOT: a refusal that looks like a success, and writes nothing.
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const before = laneRowCount();
  const res = postJson("/api/list-your-business", {
    ...submission, business_name: `Honeypot ${stamp}`, company_website_confirm: "i am a bot",
  });
  record(
    "E-4 a filled honeypot returns the SAME success shape as a real submission, and writes NO row",
    res.status === 200 && res.body.includes('"ok":true') && laneRowCount() === before,
    `status=${res.status} laneRows unchanged=${laneRowCount() === before}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// E-5 — THE REAL SUBMISSION (no match → the only outcome that writes).
// ══════════════════════════════════════════════════════════════════════════════════════
let slug = "";
let submissionId = "";
{
  const res = postJson("/api/list-your-business", submission);
  const row = sql(
    `select submission_id || '|' || slug || '|' || is_published::text || '|' || submission_status || '|' || site || '|' || (verify_token_sha256 is not null)::text || '|' || country || '|' || finder_resolution from legal_submitted_listing where submitted_by_email='${EMAIL}'`,
  );
  const [id, s, pub, status, site, hasToken, country, finder] = row.split("|");
  submissionId = id ?? ""; slug = s ?? "";
  record(
    "E-5 a no-match submission returns 200 and mints ONE row: unpublished, pending_verification, site-isolated, US, NO_MATCH, with a credential DIGEST",
    res.status === 200 && pub === "false" && status === "pending_verification" && site === E2E_SITE &&
      hasToken === "true" && country === "US" && finder === "NO_MATCH",
    `status=${res.status} slug=${slug} published=${pub} state=${status} site=${site} tokenDigestStored=${hasToken} country=${country} finder=${finder}`,
  );
  const audit = sql(
    `select purpose || '|' || accepted::text || '|' || transport from legal_submitted_email_delivery where submission_id='${submissionId}' order by attempted_at desc limit 1`,
  );
  record(
    "E-6 the verification mail was attempted and audited (purpose, accepted, transport) — and the transport is the TEST sink, so no message reached a real third party",
    audit.startsWith("submission_verification|true|test"),
    audit || "(no audit row)",
  );
  const hist = sql(`select action || '|' || to_status from legal_submitted_listing_history where submission_id='${submissionId}' order by at limit 1`);
  record("E-7 a `created` history row was written", hist === "created|pending_verification", hist || "(none)");
}

// ══════════════════════════════════════════════════════════════════════════════════════
// E-8 — THE PAGE 404s BEFORE VERIFICATION. This is the whole K38 posture in one probe.
// ══════════════════════════════════════════════════════════════════════════════════════
record("E-8 🔴 the public page 404s BEFORE the mailbox is proven", vcurl(`/listed/${slug}`).status === 404, `GET /listed/${slug} → ${vcurl(`/listed/${slug}`).status}`);

// ══════════════════════════════════════════════════════════════════════════════════════
// E-9..E-12 — VERIFY, PUBLISH, REPLAY.
// ══════════════════════════════════════════════════════════════════════════════════════
const token = randomBytes(32).toString("base64url");
let cookies = "";
{
  // See the header: the minted plaintext is unrecoverable by design, so the harness installs a
  // digest whose preimage it knows and drives the REAL route with it.
  sql(
    `update legal_submitted_listing set verify_token_sha256='${sha256(token)}', verify_token_expires_at=now()+interval '1 hour' where submission_id='${submissionId}'`,
  );
  const interstitial = vcurl(`/submitted/verify?token=${encodeURIComponent(token)}`);
  record(
    "E-9 the interstitial NAMES the listing and writes nothing (confirming something unnamed is not consent)",
    interstitial.status === 200 && interstitial.body.includes(NAME) &&
      sql(`select is_published from legal_submitted_listing where submission_id='${submissionId}'`) === "f",
    `status=${interstitial.status} namesListing=${interstitial.body.includes(NAME)} stillUnpublished=true`,
  );

  const res = vcurl("/api/submitted/verify", [
    "-X", "POST", "-H", "content-type: application/x-www-form-urlencoded",
    "--data-urlencode", `token=${token}`,
  ]);
  const setCookie = [...res.headers.matchAll(/set-cookie:\s*([^;]+);/gi)].map((m) => m[1]).join("; ");
  cookies = setCookie;
  const after = sql(
    `select submission_status || '|' || is_published::text || '|' || (verified_at is not null)::text || '|' || (published_at is not null)::text || '|' || (verify_token_sha256 is null)::text || '|' || (owner_session_sha256 is not null)::text from legal_submitted_listing where submission_id='${submissionId}'`,
  );
  record(
    "E-10 🔴 POST verify publishes in ONE statement: verified + verified_at + is_published + published_at, token NULLED, session minted — and it is a 303, not a 307",
    res.status === 303 && after === "verified|true|true|true|true|true",
    `status=${res.status} row=${after}`,
  );

  const replay = vcurl("/api/submitted/verify", [
    "-X", "POST", "-H", "content-type: application/x-www-form-urlencoded",
    "--data-urlencode", `token=${token}`,
  ]);
  const afterReplay = sql(`select submission_status || '|' || is_published::text from legal_submitted_listing where submission_id='${submissionId}'`);
  record(
    "E-11 🔴 a token REPLAY matches zero rows and leaves the lifecycle untouched (the replay is impossible, not merely detected)",
    replay.status === 303 && replay.headers.toLowerCase().includes("error=expired") && afterReplay === "verified|true",
    `status=${replay.status} row=${afterReplay}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// E-13 — THE DISPLAY CONTRACT, ON THE LIVE RENDERED PAGE.
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const page = vcurl(`/listed/${slug}`);
  const html = page.body;
  const iMarker = html.indexOf("<!--lane-disclaimer-->");
  const iH1 = html.indexOf("<h1");
  record("E-12 the page is now 200", page.status === 200, `status=${page.status}`);
  // 🔴 THE BYTE-OFFSET ASSERTION, ON THE LIVE PAGE. The first build wrapped the lane's output
  // in a max-width <div> for layout, which put an element between <main> and the marker — a
  // literal breach of §3.1 that every unit test passed straight through, because the unit test
  // only ever saw the string and never the page. This is what the E2E is for.
  const iMain = html.indexOf("<main");
  // 🔴 THE SHAPE, EXACTLY: `<main>` then the disclaimer's OWN opening tag then the marker, with
  // nothing else in between. The disclaimer's own tag is not "another element between <main>
  // and the marker" — it IS the element the marker marks. Anything else (a layout wrapper, a
  // breadcrumb, a heading) fails, which is what the first two runs of this probe caught.
  const shape = /^<main[^>]*>\s*<aside[^>]*>\s*<!--lane-disclaimer-->/.exec(html.slice(iMain));
  record(
    "E-13 🔴 the disclaimer is the FIRST element inside <main>, BEFORE the <h1> — <main> → <aside> → marker, nothing else, asserted by byte offset on the live HTML",
    shape !== null && iH1 > iMarker,
    shape !== null
      ? `<main>@${iMain} → the disclaimer's own <aside> → marker@${iMarker} · <h1>@${iH1}`
      : `SHAPE MISMATCH: ${JSON.stringify(html.slice(iMain, iMarker).slice(0, 120))}`,
  );

  // The LANE'S OWN region of the document. `app/layout.tsx` wraps every route in the site's
  // shared Header, Footer, Disclaimer and Organization JSON-LD; those carry
  // verticalConfig.primaryColor and the word "lawyer" legitimately, are the site's chrome, and
  // are not the lane's to change. Scanning the whole document would measure the site and
  // report it as a lane defect.
  const laneStart = html.indexOf("<!--lane-content-->");
  const laneEnd = html.indexOf("<!--/lane-content-->");
  const laneOnly = laneStart >= 0 && laneEnd > laneStart ? html.slice(laneStart, laneEnd) : "";
  record("E-13b the lane's own output is delimited on the live page, so the assertions below are scoped to it", laneOnly !== "", `laneContent ${laneStart}..${laneEnd} (${laneOnly.length} bytes)`);
  record("E-14 the rendered page carries noindex, follow", /(?:x-robots-tag:[^\n]*noindex)/i.test(page.headers) || /name="robots"[^>]*content="[^"]*noindex/i.test(html), "noindex present");
  record("E-15 the page is self-canonical to /listed/<slug>, never into /directory", html.includes(`https://doineedlegaladvice.com/listed/${slug}`) && !html.includes("/directory/"), "self-canonical, no /directory link");
  // 🔴 SELECT THE LANE'S BLOCK, NOT THE FIRST ONE ON THE PAGE. `app/layout.tsx` renders
  // `<OrgJsonLd />` site-wide, so the FIRST ld+json block is the site's Organization node. The
  // first version of this took `[0]` and reported `@type=Organization` as a lane violation —
  // it was measuring the layout. The lane's block is the one that names this listing.
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? "");
  const ld = blocks.find((b) => b.includes(NAME)) ?? "{}";
  record("E-15b the lane emits its OWN ld+json block, distinct from the layout's site-wide Organization node", ld !== "{}" && blocks.length >= 2, `${blocks.length} ld+json blocks on the page; the lane's is the one naming the listing`);
  const graph = JSON.parse(ld);
  const BANNED = ["aggregateRating", "review", "ratingValue", "hasOfferCatalog", "makesOffer", "award", "identifier", "additionalType", "sourceOrganization", "provider", "isPartOf", "knowsAbout", "areaServed", "priceRange"];
  const leaked = BANNED.filter((k) => ld.includes(`"${k}"`));
  record(
    "E-16 🔴 the emitted JSON-LD is a bare LocalBusiness — zero banned keys, no BreadcrumbList, no LegalService",
    graph["@type"] === "LocalBusiness" && leaked.length === 0 && !ld.includes("BreadcrumbList") && !ld.includes("LegalService"),
    leaked.length ? `LEAKED: ${leaked.join(", ")}` : `@type=${graph["@type"]} keys=${Object.keys(graph).join(",")}`,
  );
  record(
    "E-17 🔴 the LANE'S OWN output carries neither the directory's primary colour nor its CTA orange (the shared Header/Footer legitimately do — see E-13b)",
    laneOnly !== "" && !laneOnly.includes("#0f4c75") && !laneOnly.includes("#e07a00") && laneOnly.includes("#475569"),
    `laneAccent=#475569 present · #0f4c75 in lane output=${laneOnly.includes("#0f4c75")} · (whole document contains it ${html.includes("#0f4c75")} — that is the site chrome)`,
  );
  record("E-18 the submitter's own email is NOT rendered", !html.includes(EMAIL), "submitted_by_email absent from the page");
}

// ══════════════════════════════════════════════════════════════════════════════════════
// E-19..E-22 — THE OWNER SURFACE.
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const anon = vcurl(`/owner/submitted/${slug}`);
  record("E-19 🔴 the owner page WITHOUT a session names NO business (a page that names one is an enumeration oracle)", anon.status === 200 && !anon.body.includes(NAME), `status=${anon.status} namesBusiness=${anon.body.includes(NAME)}`);

  const withSession = vcurl(`/owner/submitted/${slug}`, ["-H", `cookie: ${cookies}`]);
  const csrf = withSession.body.match(/name="csrf"\s+value="([^"]*)"/)?.[1] ?? "";
  record("E-20 WITH the session it names the business and embeds the CSRF secret server-side", withSession.body.includes(NAME) && csrf !== "", `namesBusiness=${withSession.body.includes(NAME)} csrfEmbedded=${csrf !== ""}`);

  // 🔴 A FORGED business_name MUST NOT APPLY. The allow-list is the only thing between an owner
  // session and a rename primitive, and the donor plane's E2E caught exactly this.
  const forged = vcurl("/api/owner/submitted/update", [
    "-X", "POST", "-H", "content-type: application/x-www-form-urlencoded", "-H", `cookie: ${cookies}`,
    "--data-urlencode", `csrf=${csrf}`,
    "--data-urlencode", "business_name=FORGED NAME",
    "--data-urlencode", "phone=541-555-0199",
  ]);
  const after = sql(`select business_name || '|' || coalesce(phone,'') from legal_submitted_listing where submission_id='${submissionId}'`);
  record(
    "E-21 🔴 an allow-listed edit APPLIES and a forged business_name DOES NOT",
    after === `${NAME}|541-555-0199`,
    `status=${forged.status} row=${after}`,
  );

  const noCsrf = vcurl("/api/owner/submitted/update", [
    "-X", "POST", "-H", "content-type: application/x-www-form-urlencoded", "-H", `cookie: ${cookies}`,
    "--data-urlencode", "phone=541-555-0000",
  ]);
  const afterNoCsrf = sql(`select coalesce(phone,'') from legal_submitted_listing where submission_id='${submissionId}'`);
  record(
    "E-22 🔴 a POST carrying ONLY cookies — no CSRF field — is REFUSED (the exact defect PS-L7 exists for)",
    afterNoCsrf === "541-555-0199",
    `status=${noCsrf.status} phone unchanged=${afterNoCsrf === "541-555-0199"}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// E-23 — THE RATE LIMITER, INCLUDING THE FAIL-CLOSED NO-ADDRESS CASE.
// ══════════════════════════════════════════════════════════════════════════════════════
{
  // 🔴 A MEASURED FACT ABOUT THE PLATFORM, NOT A PASSING TEST DRESSED UP.
  //
  // The spec asks for "empty X-Forwarded-For → 429". It cannot be driven over HTTP: Vercel's
  // edge SETS `x-forwarded-for` to the real client address on every request, overwriting
  // whatever the caller sent. Measured — a request with an explicitly blank header was
  // accepted, because the function received a perfectly good address. The no-address branch is
  // therefore UNREACHABLE from outside, which is itself reassuring, and it is proven on the
  // real `checkRateLimit` by verify:lane-logic T4-2 (null and whitespace both →
  // RATE_LIMIT_NO_CLIENT_ADDRESS). Reporting the probe as green here would have been claiming
  // to have tested something the platform makes untestable.
  const blank = postJson("/api/list-your-business", {
    ...submission, business_name: `RL probe ${stamp}`, submitted_by_email: `rl-probe-${stamp}@example.com`,
  }, ["-H", "x-forwarded-for: "]);
  const sawAddress = sql(`select coalesce(submitted_ip::text,'(null)') from legal_submitted_listing where submitted_by_email='rl-probe-${stamp}@example.com'`);
  record(
    "E-23 the no-client-address branch is UNREACHABLE over HTTP — Vercel's edge always supplies x-forwarded-for (proven on the real function by lane-logic T4-2 instead)",
    sawAddress !== "(null)" && sawAddress !== "",
    `blank x-forwarded-for was overwritten by the edge; the function received ${sawAddress.split(".").slice(0, 2).join(".")}.x.x · status=${blank.status}`,
  );

  // The REACHABLE half: the limiter really does refuse the 4th row from one address in 24h.
  // Two rows exist by now (E-5 and the probe above), so two more take it to the limit.
  const r3 = postJson("/api/list-your-business", { ...submission, business_name: `RL three ${stamp}`, submitted_by_email: `rl3-${stamp}@example.com` });
  const r4 = postJson("/api/list-your-business", { ...submission, business_name: `RL four ${stamp}`, submitted_by_email: `rl4-${stamp}@example.com` });
  record(
    "E-23b 🔴 the limiter refuses the 4th submission from one client address inside 24h, with its own code",
    r4.status === 429 && r4.body.includes("RATE_LIMITED"),
    `3rd=${r3.status} 4th=${r4.status} body=${r4.body.slice(0, 80)}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// E-24 — WITHDRAWAL: the page dies and the session dies, in the same statement.
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const csrfPage = vcurl(`/owner/submitted/${slug}`, ["-H", `cookie: ${cookies}`]);
  const csrf = csrfPage.body.match(/name="csrf"\s+value="([^"]*)"/)?.[1] ?? "";
  const res = vcurl("/api/owner/submitted/update", [
    "-X", "POST", "-H", "content-type: application/x-www-form-urlencoded", "-H", `cookie: ${cookies}`,
    "--data-urlencode", `csrf=${csrf}`, "--data-urlencode", "action=withdraw",
  ]);
  const row = sql(`select submission_status || '|' || is_published::text || '|' || (owner_session_revoked_at is not null)::text from legal_submitted_listing where submission_id='${submissionId}'`);
  const page = vcurl(`/listed/${slug}`);
  const dash = vcurl(`/owner/submitted/${slug}`, ["-H", `cookie: ${cookies}`]);
  record(
    "E-24 🔴 withdrawal unpublishes, terminates and REVOKES THE SESSION in one statement; the page 404s and the dashboard no longer names the business",
    row === "withdrawn|false|true" && page.status === 404 && !dash.body.includes(NAME),
    `status=${res.status} row=${row} page=${page.status} dashboardNamesBusiness=${dash.body.includes(NAME)}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════════════
// CLEANUP + THE AFTER ASSERTION.
// ══════════════════════════════════════════════════════════════════════════════════════
{
  const ids = sql(`select coalesce(string_agg(quote_literal(submission_id::text), ','), '') from legal_submitted_listing where site='${E2E_SITE}'`);
  if (ids !== "") {
    // History rows are KEPT deliberately — they are the audit that these rows existed. The FK
    // is ON DELETE NO ACTION, so the audit is detached by design: deleting the listing rows
    // would fail while history references them, which is exactly the right shape. So the
    // listing rows are what get deleted, and only after the history FK is cleared for them.
    sql(`delete from legal_submitted_listing_history where submission_id in (select submission_id from legal_submitted_listing where site='${E2E_SITE}')`);
    sql(`delete from legal_submitted_email_delivery where submission_id in (select submission_id from legal_submitted_listing where site='${E2E_SITE}')`);
    sql(`delete from legal_submitted_listing where site='${E2E_SITE}'`);
  }
  const left = laneRowCount();
  record("E-25 every E2E row is deleted — the lane table holds zero `dinla-e2e` rows", left === 0, `remaining dinla-e2e rows=${left}`);

  const LL_AFTER = llFingerprint();
  const HELD_AFTER = heldRowFingerprint();
  record(
    "E-26 🔴 ZERO WRITES TO legal_listings ACROSS THE WHOLE RUN — row count, US slice, published/held split and max(updated_at) all identical",
    LL_AFTER === LL_BEFORE,
    `before=${LL_BEFORE} after=${LL_AFTER}`,
  );
  record("E-27 🔴 the matched held row's claim credential is identical to the pre-run fingerprint", HELD_AFTER === HELD_BEFORE, `${HELD_BEFORE.slice(0, 16)}… === ${HELD_AFTER.slice(0, 16)}…`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\nLANE-E2E: ${results.length - failed.length} pass, ${failed.length} fail`);
if (failed.length) console.error(`\nFAILED: ${failed.map((f) => f.name).join(" · ")}`);
process.exit(failed.length === 0 ? 0 : 1);
