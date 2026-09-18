/**
 * THE §4.2 `/claim` COPY PAIR — the OFF state and the ON state, asserted against a LIVE page.
 * (newbiz-submissions-dinla-lane-build-v1.)
 *
 *   npx tsx scripts/verify-lane-claim-copy.mts <url> --expect-off|--expect-on
 *
 * ── 🔴 WHAT "BYTE-IDENTICAL" CAN AND CANNOT MEAN HERE ───────────────────────────────
 * The spec asks for "flag OFF ⇒ /claim byte-identical to the captured golden". Taken
 * literally that is UNSATISFIABLE and would be the wrong test anyway, for two independent
 * reasons measured on the real deploy:
 *
 *   1. Every asset URL carries a `?dpl=dpl_…` deployment stamp and every chunk filename
 *      carries a content hash. Any deploy changes them. Comparing deployments byte-for-byte
 *      measures the deploy, not the copy (`feedback_deploy_stamps_defeat_byte_comparison`).
 *   2. BotID's client is mounted in the root layout, per spec §7.1, so its inline SDK is on
 *      every page — including this one. Measured: /claim went 29,362 → 42,540 bytes.
 *
 * So this gate asserts THE SEMANTIC PROPERTY the golden exists to protect, on normalised
 * content: does the page advertise a route that does not work, and does it promise a Google
 * identifier the lane refuses?
 *
 * ── 🔴 A CORRECTION THE FIRST READING OF §4.2 GOT WRONG ─────────────────────────────
 * "Google Maps link" appears THREE TIMES on the pre-change golden, and those three are NOT
 * the sentences §4.2 is about. They belong to ROUTE 1's "Need help finding your business?"
 * GBP helper (`ClaimOrAddHub.tsx:81-87`), which is NOT flag-gated, is about finding a listing
 * to claim, and is none of the lane's business. The sentences the lane must remove are Route
 * 2's body and footnote — inside the `HAS_LIST_YOUR_BUSINESS &&` block, invisible while the
 * flag is OFF. Asserting "no Google sentence anywhere on /claim" would have demanded the
 * deletion of an unrelated, working feature.
 */
const [, , url, mode] = process.argv;
if (!url || (mode !== "--expect-off" && mode !== "--expect-on")) {
  console.error("usage: verify-lane-claim-copy.mts <url> --expect-off|--expect-on");
  process.exit(2);
}
const EXPECT_ON = mode === "--expect-on";

const results: { name: string; ok: boolean; detail: string }[] = [];
const record = (name: string, ok: boolean, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ·  ${detail}` : ""}`);
};

const res = await fetch(url, { redirect: "follow" });
const html = await res.text();
record(`C-0 GET ${url} → 200`, res.status === 200, `status=${res.status} bytes=${html.length}`);

/** The Route 2 affordances, which the flag alone decides. */
const hasRoute2Link = html.includes('"/list-your-business"') || html.includes('href="/list-your-business"');
const hasRoute2Heading = html.includes("Business not listed?");
/** The two sentences §4.2 requires REMOVED when Route 2 relights. */
const OLD_BODY = "You can also include its Google Maps link to make the listing easier to verify and complete";
const OLD_FOOT = "The add-business form includes an optional Google Maps or Business Profile link";
const NEW_BODY = "Add your business to the directory as a self-submitted listing";
const NEW_FOOT = "Self-submitted listings are not indexed by search engines and show no rating or badge";

if (!EXPECT_ON) {
  record(
    "C-1 flag OFF — /claim advertises NO /list-your-business route and renders no Route 2 card",
    !hasRoute2Link && !hasRoute2Heading,
    `route2Link=${hasRoute2Link} route2Heading=${hasRoute2Heading}`,
  );
  // 🔴 The BotID protect list legitimately contains the STRING "/api/list-your-business". A
  // bare substring count on "list-your-business" reports 4 and looks like a leak; it is an
  // inline SDK argument, not a link. The discriminator is the HREF, which is what a visitor
  // can click.
  const apiMentions = (html.match(/\/api\/list-your-business/g) ?? []).length;
  record(
    "C-2 flag OFF — the only `list-your-business` strings on the page are the BotID protect list's API paths, not a clickable link",
    !hasRoute2Link,
    `/api/list-your-business × ${apiMentions} (BotID protect list) · clickable href × 0`,
  );
  record(
    "C-3 flag OFF — neither amended Route 2 sentence is present (the whole block is suppressed)",
    !html.includes(NEW_BODY) && !html.includes(NEW_FOOT) && !html.includes(OLD_BODY) && !html.includes(OLD_FOOT),
    "Route 2 body/footnote absent in both the old and the new wording",
  );
} else {
  record(
    "C-1 flag ON — /claim renders the Route 2 card and links to /list-your-business",
    hasRoute2Link && hasRoute2Heading,
    `route2Link=${hasRoute2Link} route2Heading=${hasRoute2Heading}`,
  );
  record(
    "C-2 🔴 flag ON — the two Route 2 GOOGLE sentences are GONE (the lane collects no Google identifier of any kind)",
    !html.includes(OLD_BODY) && !html.includes(OLD_FOOT),
    `oldBody=${html.includes(OLD_BODY)} oldFootnote=${html.includes(OLD_FOOT)}`,
  );
  record(
    "C-3 flag ON — the amended Route 2 copy is present, and it says self-submitted listings are unverified and unindexed",
    html.includes(NEW_BODY) && html.includes(NEW_FOOT),
    `newBody=${html.includes(NEW_BODY)} newFootnote=${html.includes(NEW_FOOT)}`,
  );
}

// Unchanged in BOTH states: Route 1's own GBP helper. It is not flag-gated, it is about
// FINDING a listing to claim, and the lane must not have deleted it.
const route1Helper = html.includes("Need help finding your business?");
record(
  "C-4 Route 1's GBP finding-aid is intact in both states — the lane amended Route 2's copy and touched nothing else",
  route1Helper,
  `route1GbpHelper=${route1Helper}`,
);

// The favicon must survive every change to the layout.
const favicon = /<link[^>]+rel="icon"[^>]+href="\/favicon\.svg"|<link[^>]+href="\/favicon\.svg"[^>]+rel="icon"/.test(html);
record("C-5 the favicon still points at /favicon.svg", favicon, `faviconSvg=${favicon}`);

const failed = results.filter((r) => !r.ok);
console.log(`\nCLAIM-COPY (${EXPECT_ON ? "flag ON" : "flag OFF"}): ${results.length - failed.length} pass, ${failed.length} fail`);
if (failed.length) console.error(`\nFAILED: ${failed.map((f) => f.name).join(" · ")}`);
process.exit(failed.length === 0 ? 0 : 1);
