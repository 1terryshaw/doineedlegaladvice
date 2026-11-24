// proof-of-life phase 3 — spam-drop reason classification (mirrors shouldSilentDrop).
import assert from "node:assert/strict";
import test from "node:test";
import { shouldSilentDrop } from "../lib/inquiry-guard";
import { silentDropReason } from "../lib/lead-drop";

test("honeypot drops are classified honeypot; spam protection unchanged", () => {
  assert.equal(shouldSilentDrop({ honeypot: "x", renderedAt: Date.now() - 60_000 } as never), true);
  assert.equal(silentDropReason("x"), "honeypot");
});
test("sub-2.5s drops are classified too_fast", () => {
  assert.equal(shouldSilentDrop({ honeypot: "", renderedAt: Date.now() } as never), true);
  assert.equal(silentDropReason(""), "too_fast");
  assert.equal(silentDropReason(undefined), "too_fast");
});
test("a normal human submission is not dropped", () => {
  assert.equal(shouldSilentDrop({ honeypot: "", renderedAt: Date.now() - 30_000 } as never), false);
});
