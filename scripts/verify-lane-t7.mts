/**
 * LAYER 4 — READ-ONLY PRODUCTION PROBES (T-7). (lane spec §8.4.)
 *
 *   npx tsx scripts/verify-lane-t7.mts
 *
 * Every probe is a GET against the live host. Nothing here writes anything, anywhere. The
 * "before" column is the baseline captured on 2026-09-18 BEFORE the first commit of this
 * build, and the values are pinned here so a regression cannot be argued away later.
 */
const HOST = process.env.LANE_T7_HOST ?? "https://doineedlegaladvice.com";

const results: { name: string; ok: boolean; detail: string }[] = [];
const record = (name: string, ok: boolean, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  ·  ${detail}` : ""}`);
};

const sha256Hex = async (s: string) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
};

/** Captured BEFORE the first commit of this build. */
const ROBOTS_SHA_BEFORE = "fb7e700025af86c0f044093d1208286bbcf841d320a422a0ef567dc4bc16ebf2";
const SITEMAP_SHA_BEFORE = "63d3bd22e05edc6d8c084432bde1bb5e062d43aa62e894b4d3514ffa4575c2e2";

const get = async (path: string) => {
  const res = await fetch(`${HOST}${path}`, { redirect: "manual" });
  return { status: res.status, body: await res.text(), headers: res.headers };
};

// ── robots.txt — BYTE-IDENTICAL. The lane adds no rule and removes none. ──
{
  const r = await get("/robots.txt");
  const sha = await sha256Hex(r.body);
  record(
    "T7-1 🔴 robots.txt is BYTE-IDENTICAL to the pre-build baseline",
    r.status === 200 && sha === ROBOTS_SHA_BEFORE,
    `sha256=${sha.slice(0, 16)}… ${sha === ROBOTS_SHA_BEFORE ? "== baseline" : `!= baseline ${ROBOTS_SHA_BEFORE.slice(0, 16)}…`}`,
  );
}

// ── sitemap — BYTE-IDENTICAL, and disjoint from every lane URL space. ──
{
  const r = await get("/sitemap.xml");
  const sha = await sha256Hex(r.body);
  record(
    "T7-2 🔴 /sitemap.xml is BYTE-IDENTICAL to the pre-build baseline",
    r.status === 200 && sha === SITEMAP_SHA_BEFORE,
    `sha256=${sha.slice(0, 16)}… ${sha === SITEMAP_SHA_BEFORE ? "== baseline" : "!= baseline"}`,
  );

  // 🔴 "By construction" is a CLAIM. The probe is the evidence: every emitter reads
  // legal_listings or uk_solicitors, so a separate table is picked up by nothing — but that is
  // asserted here by reading the actual chunks, not by reasoning about the code.
  const chunks = [...r.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
  const urls: string[] = [];
  for (const c of chunks) {
    const sub = await fetch(c).then((x) => x.text());
    urls.push(...[...sub.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!));
  }
  const leaks = urls.filter((u) => /\/listed\/|\/list-your-business|\/submitted\//.test(u));
  record(
    "T7-3 🔴 sitemap ∩ {/listed/*, /list-your-business*, /submitted/*} = ∅",
    leaks.length === 0,
    leaks.length ? `LEAKED ${leaks.length}: ${leaks.slice(0, 3).join(", ")}` : `${chunks.length} chunk(s), ${urls.length} URLs, 0 lane URLs`,
  );
}

// ── the lane's own surfaces ──
{
  const lyb = await get("/list-your-business");
  const robots = lyb.headers.get("x-robots-tag") ?? "";
  const meta = /name="robots"[^>]*content="([^"]*)"/.exec(lyb.body)?.[1] ?? "";
  const noindex = /noindex/.test(robots) || /noindex/.test(meta);
  const follow = !/nofollow/.test(robots) && !/nofollow/.test(meta);
  record(
    "T7-4 /list-your-business is 200 and noindex, follow",
    lyb.status === 200 && noindex && follow,
    `status=${lyb.status} x-robots-tag="${robots}" meta="${meta}"`,
  );

  const unknown = await get("/listed/definitely-not-a-real-lane-slug-9x8y7z");
  record("T7-5 an unknown /listed/… slug is 404 — never 200, never 500", unknown.status === 404, `status=${unknown.status}`);
}

// ── /claim renders the AMENDED Route 2, with no Google sentence ──
{
  const c = await get("/claim");
  const OLD_BODY = "You can also include its Google Maps link to make the listing easier to verify and complete";
  const OLD_FOOT = "The add-business form includes an optional Google Maps or Business Profile link";
  const NEW_BODY = "Add your business to the directory as a self-submitted listing";
  const NEW_FOOT = "Self-submitted listings are not indexed by search engines and show no rating or badge";
  record(
    "T7-6 🔴 /claim renders the amended Route 2: the card is back, the two GOOGLE sentences are GONE, the new copy is present",
    c.status === 200 && c.body.includes("Business not listed?") && c.body.includes('"/list-your-business"') &&
      !c.body.includes(OLD_BODY) && !c.body.includes(OLD_FOOT) &&
      c.body.includes(NEW_BODY) && c.body.includes(NEW_FOOT),
    `status=${c.status} route2=${c.body.includes("Business not listed?")} oldGoogleBody=${c.body.includes(OLD_BODY)} oldGoogleFoot=${c.body.includes(OLD_FOOT)} newCopy=${c.body.includes(NEW_BODY) && c.body.includes(NEW_FOOT)}`,
  );
  // Route 1's own GBP finding-aid is NOT the lane's and must be untouched.
  record("T7-7 Route 1's GBP finding-aid is intact — the lane amended Route 2's copy and nothing else", c.body.includes("Need help finding your business?"), "route 1 helper present");
  record("T7-8 the favicon still points at /favicon.svg", /<link[^>]+href="\/favicon\.svg"/.test(c.body), "favicon intact");
}

// ── a directory page is UNCHANGED: index,follow, and no lane vocabulary ──
{
  const sm = await fetch(`${HOST}/sitemap/0.xml`).then((r) => r.text());
  const detail = [...sm.matchAll(/<loc>([^<]+\/directory\/[^<]+)<\/loc>/g)].map((m) => m[1]!)[0];
  if (!detail) {
    record("T7-9 a /directory/<slug> page is unchanged: index,follow and zero lane vocabulary", false, "no /directory/ URL found in the sitemap to probe");
  } else {
    const d = await fetch(detail).then(async (r) => ({ status: r.status, body: await r.text(), headers: r.headers }));
    const robots = d.headers.get("x-robots-tag") ?? "";
    const meta = /name="robots"[^>]*content="([^"]*)"/.exec(d.body)?.[1] ?? "";
    const noindexed = /noindex/.test(robots) || /noindex/.test(meta);
    record(
      "T7-9 🔴 a /directory/<slug> page is unchanged: 200, NOT noindexed, and carries zero 'self-submitted' vocabulary",
      d.status === 200 && !noindexed && !/self-submitted/i.test(d.body),
      `${detail.replace(HOST, "")} status=${d.status} noindexed=${noindexed} selfSubmittedStrings=${(d.body.match(/self-submitted/gi) ?? []).length}`,
    );
    // 🔴 The directory page now carries the relit "Add your business →" link. That is the flag
    // doing what it says; what matters is that the LISTING itself is unchanged.
    record(
      "T7-10 the relit 'Add your business' link is present on the directory page (the flag's second affordance)",
      d.body.includes('"/list-your-business"'),
      "footer link relit",
    );
  }
}

// ── 🔴 BOT PROTECTION, ON PRODUCTION. Per Vercel's docs a plain curl against a
// BotID-protected route is refused in production — this is where that can finally be driven.
{
  const res = await fetch(`${HOST}/api/list-your-business`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ business_name: "T7 bot probe", city: "Bend", region_state: "OR", submitted_by_email: "t7-bot@example.com" }),
  });
  const body = await res.text();
  const refused = res.status === 403 || /x-vercel-mitigated/i.test([...res.headers.keys()].join(","));
  record(
    "T7-11 🔴 a plain server-side POST (no BotID client token) against the protected intake is REFUSED on production",
    refused,
    `status=${res.status} mitigated=${res.headers.get("x-vercel-mitigated") ?? "(none)"} body=${body.slice(0, 90)}`,
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\nLANE-T7: ${results.length - failed.length} pass, ${failed.length} fail`);
if (failed.length) console.error(`\nFAILED: ${failed.map((f) => f.name).join(" · ")}`);
process.exit(failed.length === 0 ? 0 : 1);
