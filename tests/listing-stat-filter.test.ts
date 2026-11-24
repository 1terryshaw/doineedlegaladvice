// beacon v2 — telemetry integrity rules (owner / automation / cross-site / internal exclusion).
import assert from "node:assert/strict";
import test from "node:test";
import { serverSkipReason, clientSkipReason, urlFlags, ownerKey } from "../lib/listing-stat-filter";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const base = { ua: CHROME, secFetchSite: "same-origin", ownerCookieSlug: null, slug: "acme-lawn" };

test("a normal same-origin browser view counts", () => assert.equal(serverSkipReason(base), null));
test("no Sec-Fetch header (older browsers) still counts", () => assert.equal(serverSkipReason({ ...base, secFetchSite: null }), null));
test("bots, headless, scripted clients and empty UA are not counted", () => {
  for (const ua of ["Googlebot/2.1", "Mozilla/5.0 HeadlessChrome/131", "curl/8.5", "python-requests/2.31", "axios/1.6", "Go-http-client/2.0", "", null])
    assert.equal(serverSkipReason({ ...base, ua }), "bot", String(ua));
});
test("cross-site posts are not counted", () => {
  assert.equal(serverSkipReason({ ...base, secFetchSite: "cross-site" }), "cross_site");
  assert.equal(serverSkipReason({ ...base, secFetchSite: "same-site" }), "cross_site");
  assert.equal(serverSkipReason({ ...base, secFetchSite: "none" }), "cross_site");
});
test("the listing's own owner (existing session cookie for this slug) is not counted", () => {
  assert.equal(serverSkipReason({ ...base, ownerCookieSlug: "acme-lawn" }), "owner");
});
test("an owner of a DIFFERENT listing browsing this one is a real view", () => {
  assert.equal(serverSkipReason({ ...base, ownerCookieSlug: "other-biz" }), null);
});
test("client: automation, internal opt-out and owner device suppress counting", () => {
  assert.equal(clientSkipReason({ webdriver: true, internal: false, ownerDevice: false }), "automation");
  assert.equal(clientSkipReason({ webdriver: false, internal: true, ownerDevice: false }), "internal");
  assert.equal(clientSkipReason({ webdriver: false, internal: false, ownerDevice: true }), "owner_device");
  assert.equal(clientSkipReason({ webdriver: false, internal: false, ownerDevice: false }), null);
});
test("url flags: ?ls_internal=1/0 and ?ref=owner", () => {
  assert.deepEqual(urlFlags("?ls_internal=1"), { internal: "1", ownerRef: false });
  assert.deepEqual(urlFlags("?ls_internal=0&ref=owner"), { internal: "0", ownerRef: true });
  assert.deepEqual(urlFlags("?utm_source=x"), { internal: null, ownerRef: false });
  assert.equal(ownerKey("acme"), "ls_owner:acme");
});
