#!/usr/bin/env node
/**
 * verify-data-sources.mjs — FAIL-LOUD build gate for the /data-credits manifest.
 *
 * Runs as `prebuild`. The build STOPS if this repo's data-sources.json is missing,
 * malformed, or contains a source with no researched attribution contract.
 *
 * The reason it is fail-loud rather than fail-quiet: a credits page that silently
 * omits a source is not a smaller page, it is a false provenance claim on a legal
 * surface. Some of the licences we seed under (ODbL §4.3, CC BY 4.0) make the credit
 * a CONDITION of the right to republish at all — an omitted credit is a breach, and a
 * breach that ships green is worse than a red build.
 *
 * It never guesses. An unresearched source must be written as UNRESEARCHED/UNMAPPED,
 * and that is exactly what trips the gate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data-sources.json");
const REL = "data-sources.json";

const errors = [];
const fail = (msg) => errors.push(msg);

if (!fs.existsSync(FILE)) {
  console.error(
    `\n[data-sources] FAIL: ${REL} is missing.\n` +
      `  Every repo that serves compiled listing data owes a source manifest.\n` +
      `  Create it from the canonical research (empire-legal-audit/{authority_map.py,verdicts.json}).\n`,
  );
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch (e) {
  console.error(`\n[data-sources] FAIL: ${REL} is not valid JSON — ${e.message}\n`);
  process.exit(1);
}

const REQUIRED_STRINGS = ["source_tag", "authority", "dataset", "licence"];
const NONE_ASSERTED_LICENCE = "No licence asserted — provenance not recorded";
const SENTINELS = new Set(["UNMAPPED", "UNRESEARCHED", "UNKNOWN", "TODO", "TBD", ""]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

if (typeof manifest.repo !== "string" || !manifest.repo) fail(`"repo" must be a non-empty string`);
if (!Array.isArray(manifest.sources)) {
  fail(`"sources" must be an array`);
} else if (manifest.sources.length === 0) {
  fail(`"sources" is empty — a directory that serves rows has at least one source`);
}

const seen = new Set();
for (const [i, s] of (manifest.sources ?? []).entries()) {
  const at = `sources[${i}]${s && s.source_tag ? ` (${s.source_tag})` : ""}`;
  if (typeof s !== "object" || s === null) {
    fail(`${at}: not an object`);
    continue;
  }

  for (const k of REQUIRED_STRINGS) {
    const v = s[k];
    if (typeof v !== "string" || !v.trim()) {
      fail(`${at}: "${k}" must be a non-empty string`);
    } else if (SENTINELS.has(v.trim().toUpperCase())) {
      fail(
        `${at}: "${k}" is "${v}" — this source has NO researched contract. ` +
          `Research the authority and write its verdict; do not guess a credit.`,
      );
    }
  }

  // contract_status is the only way an entry may lack a researched licence, and it is
  // never blank-able: NONE_ASSERTED has to be written out, justified in prose, and
  // carry the work it is waiting on. It renders on the public page.
  if (s.contract_status !== "RESEARCHED" && s.contract_status !== "NONE_ASSERTED") {
    fail(
      `${at}: "contract_status" must be "RESEARCHED" or "NONE_ASSERTED", got ` +
        `${JSON.stringify(s.contract_status)}. A source with no stated contract status is a silent gap.`,
    );
  }

  if (s.contract_status === "NONE_ASSERTED") {
    if (s.licence !== NONE_ASSERTED_LICENCE) {
      fail(`${at}: contract_status=NONE_ASSERTED requires licence exactly "${NONE_ASSERTED_LICENCE}"`);
    }
    if (s.attribution_required !== false) {
      fail(`${at}: contract_status=NONE_ASSERTED cannot require an attribution — no licence is asserted`);
    }
    if (s.confidence !== "LOW") {
      fail(`${at}: contract_status=NONE_ASSERTED must be confidence LOW`);
    }
    if (typeof s.note !== "string" || s.note.trim().length < 60) {
      fail(
        `${at}: contract_status=NONE_ASSERTED requires a written "note" (>=60 chars) explaining ` +
          `why provenance is irrecoverable. It is shown to the public.`,
      );
    }
    if (typeof s.review_owed !== "string" || !s.review_owed.trim()) {
      fail(`${at}: contract_status=NONE_ASSERTED requires "review_owed" — the work that closes the gap`);
    }
  }

  if (typeof s.source_tag === "string") {
    if (seen.has(s.source_tag)) fail(`${at}: duplicate source_tag`);
    seen.add(s.source_tag);
  }

  if (typeof s.attribution_required !== "boolean") {
    fail(`${at}: "attribution_required" must be a boolean (true/false), not inferred`);
  }

  if (s.attribution_required === true) {
    if (typeof s.attribution_line !== "string" || !s.attribution_line.trim()) {
      fail(
        `${at}: attribution_required=true but "attribution_line" is empty. ` +
          `The licence makes crediting a CONDITION — the verbatim line is mandatory.`,
      );
    }
    if (typeof s.licence_url !== "string" || !s.licence_url.trim()) {
      fail(`${at}: attribution_required=true but "licence_url" is empty`);
    }
  } else if (s.attribution_required === false && s.attribution_line) {
    fail(
      `${at}: attribution_required=false yet an attribution_line is set. ` +
        `Either the credit is required or it is not — a composed courtesy line is a guess.`,
    );
  }

  // ── PLAIN CREDIT FOR IRRECOVERABLE PROVENANCE (schema 1.2.0) ───────────────
  // Distinct from `credit_line` on purpose. `credit_line` says a licence page
  // exists and the read was BLOCKED, so a verbatim line is still owed. This says
  // there is no page and never will be — the authority was not recorded at load
  // time. It therefore takes NO source_url (there is none to attempt) and NO
  // verbatim_pending (nothing is pending). It may never appear on a RESEARCHED
  // entry: where a licence WAS read, the licence's own answer governs, and a
  // composed phrase alongside it would read as a second, invented credit.
  if (s.plain_credit !== undefined) {
    if (typeof s.plain_credit !== "string" || !s.plain_credit.trim()) {
      fail(`${at}: "plain_credit" must be a non-empty string when present`);
    }
    if (s.contract_status !== "NONE_ASSERTED") {
      fail(
        `${at}: "plain_credit" on a ${s.contract_status} entry. A plain credit is only for ` +
          `IRRECOVERABLE provenance; where a licence was read, quote what it requires instead.`,
      );
    }
    if (s.attribution_required !== false) {
      fail(`${at}: "plain_credit" with attribution_required=true — a plain credit is not a licence condition`);
    }
    if (s.attribution_line) {
      fail(`${at}: "plain_credit" alongside an "attribution_line" — that is two credits for one source`);
    }
  }

  // ── PRECAUTIONARY CREDITS (schema 1.1.0) ───────────────────────────────────
  // A credit we emit because the licence text could NOT be read and quoted. It is
  // never allowed to masquerade as a licence condition, and it may never be a bare
  // composed phrase: it must carry verbatim_pending, the URL that was attempted, and
  // a written note saying why the read failed.
  if (s.credit_line !== undefined) {
    if (typeof s.credit_line !== "string" || !s.credit_line.trim()) {
      fail(`${at}: "credit_line" must be a non-empty string when present`);
    }
    if (s.verbatim_pending !== true) {
      fail(
        `${at}: "credit_line" without verbatim_pending=true. A plain credit is only ever ` +
          `emitted BECAUSE the verbatim licence line is still owed — say so explicitly.`,
      );
    }
    if (s.attribution_required !== false) {
      fail(
        `${at}: "credit_line" with attribution_required=true. A precautionary credit is not a ` +
          `licence condition; if the licence requires a line, quote it in attribution_line instead.`,
      );
    }
    if (typeof s.source_url !== "string" || !s.source_url.trim()) {
      fail(`${at}: "credit_line" requires "source_url" — the page that was actually attempted`);
    }
    if (typeof s.note !== "string" || s.note.trim().length < 60) {
      fail(
        `${at}: "credit_line" requires a written "note" (>=60 chars) saying why the licence text ` +
          `could not be read. It is shown to the public.`,
      );
    }
  } else if (s.verbatim_pending !== undefined) {
    fail(`${at}: "verbatim_pending" set with no "credit_line" — nothing is actually being credited`);
  }

  if (s.extra_clause !== undefined) {
    if (typeof s.extra_clause !== "string" || !s.extra_clause.trim()) {
      fail(`${at}: "extra_clause" must be a non-empty string when present`);
    }
    if (typeof s.extra_clause_verbatim !== "boolean") {
      fail(
        `${at}: "extra_clause" requires "extra_clause_verbatim" — the reader must be told whether ` +
          `the clause is the licensor's words or ours.`,
      );
    }
  }

  if (s.confidence !== "HIGH" && s.confidence !== "LOW") {
    fail(`${at}: "confidence" must be "HIGH" or "LOW"`);
  }
  if (
    s.confidence === "LOW" &&
    s.contract_status !== "NONE_ASSERTED" &&
    (typeof s.source_url !== "string" || !s.source_url.trim())
  ) {
    fail(`${at}: confidence=LOW requires "source_url" — the page that was actually read`);
  }

  if (s.last_seeded !== null && !ISO_DATE.test(String(s.last_seeded ?? ""))) {
    fail(`${at}: "last_seeded" must be an ISO date (YYYY-MM-DD) or null, got ${JSON.stringify(s.last_seeded)}`);
  }
}

if (errors.length) {
  console.error(`\n[data-sources] BUILD STOPPED — ${errors.length} problem(s) in ${REL}:\n`);
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error(
    `\n  Nothing here may be filled in by guessing. Research the authority's licence page,\n` +
      `  record the verbatim required credit, then re-run the build.\n`,
  );
  process.exit(1);
}

const req = manifest.sources.filter((s) => s.attribution_required).length;
const pre = manifest.sources.filter((s) => s.credit_line && s.verbatim_pending).length;
const plain = manifest.sources.filter((s) => s.plain_credit).length;
const low = manifest.sources.filter((s) => s.confidence === "LOW").length;
const none = manifest.sources.filter((s) => s.contract_status === "NONE_ASSERTED").length;
console.log(
  `[data-sources] OK — ${manifest.sources.length} source(s), ${req} attribution-required, ` +
    `${pre} precautionary (verbatim pending), ${plain} plain-credit (irrecoverable), ` +
    `${low} LOW-confidence, ${none} with no licence asserted.`,
);
